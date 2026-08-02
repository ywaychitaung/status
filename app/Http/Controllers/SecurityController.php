<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\DashboardDataService;
use App\Services\ZapScanService;
use App\Services\ZapScanner;
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

    /** Queue a ZAP baseline for every active website (runs after the response). */
    public function scanNow(Request $request): RedirectResponse
    {
        if (! $this->zap->dockerAvailable()) {
            return redirect()->route('security')->with(
                'error',
                'Docker / OWASP ZAP is not available on this server.'
            );
        }

        /** @var User $user */
        $user = $request->user();

        try {
            $this->zapScans->startAfterResponse((int) $user->id);
        } catch (Throwable $error) {
            Log::error('Manual ZAP scan failed to start: '.$error->getMessage());

            return redirect()->route('security')->with('error', 'Could not start ZAP scan.');
        }

        return redirect()->route('security')->with(
            'flash',
            'OWASP ZAP scan started for all active websites. Refresh in a few minutes for results.'
        );
    }
}
