<?php

namespace App\Http\Controllers;

use App\Exceptions\StatusException;
use App\Models\User;
use App\Services\DashboardDataService;
use App\Services\ZapScanner;
use App\Services\ZapScanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/** OWASP ZAP security scans for monitored website domains. */
class SecurityController extends Controller
{
    public function __construct(
        private readonly DashboardDataService $data,
        private readonly ZapScanService $zapScans,
        private readonly ZapScanner $zap,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('security', $this->data->securityPage($request));
    }

    public function show(Request $request, int $scan): Response|RedirectResponse
    {
        $page = $this->data->securityScanPage($request, $scan);
        if ($page === null) {
            return redirect()->route('security')->with('error', 'Scan not found.');
        }

        return Inertia::render('security-scan', $page);
    }

    /** Start a tracked ZAP batch for the current user. */
    public function scanNow(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        try {
            $this->zapScans->startManualScan($user);
        } catch (StatusException $error) {
            return redirect()->route('security')->with('error', $error->getMessage());
        } catch (Throwable $error) {
            Log::error('Manual ZAP scan failed to start: '.$error->getMessage());

            return redirect()->route('security')->with('error', 'Could not start ZAP scan.');
        }

        return redirect()->route('security')->with(
            'flash',
            'OWASP ZAP scan started. This page will update when it finishes.'
        );
    }

    /** Lightweight poll endpoint for active-run status. */
    public function scanStatus(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $run = $this->zapScans->activeRunForUser((int) $user->id);

        return response()->json([
            'activeRun' => $run?->toArrayForUi(),
            'zapReady' => $this->zap->dockerAvailable(),
        ]);
    }
}
