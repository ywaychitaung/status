<?php

namespace App\Http\Controllers;

use App\Exceptions\StatusException;
use App\Models\User;
use App\Services\AuditService;
use App\Services\DashboardDataService;
use App\Services\SecurityScanService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class SecurityController extends Controller
{
    public function __construct(
        private readonly DashboardDataService $data,
        private readonly SecurityScanService $security,
        private readonly AuditService $audits,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('security', $this->data->securityPage($request));
    }

    public function connect(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        try {
            return redirect()->away($this->security->connectUrl($user));
        } catch (StatusException $error) {
            return redirect()->route('security')->with('error', $error->getMessage());
        }
    }

    public function callback(Request $request): RedirectResponse
    {
        try {
            $installation = $this->security->completeInstall(
                $request->query('state'),
                $request->query('installation_id'),
            );

            /** @var User|null $user */
            $user = $request->user();
            if ($user !== null) {
                $this->audits->writeSafe([
                    'action' => 'github.connect',
                    'actor' => $user->toAuthUser(),
                    'entityType' => 'github_installation',
                    'entityId' => (string) $installation->installation_id,
                    'summary' => "{$user->name} connected GitHub (".($installation->account_login ?? 'installation').')',
                    'metadata' => [
                        'installationId' => $installation->installation_id,
                        'accountLogin' => $installation->account_login,
                    ],
                    'request' => $request,
                ]);
            }

            return redirect()->route('security')->with('flash', 'GitHub connected. Link a repository and domain below.');
        } catch (StatusException $error) {
            return redirect()->route('security')->with('error', $error->getMessage());
        } catch (Throwable $error) {
            Log::error('GitHub install callback failed: '.$error->getMessage());

            return redirect()->route('security')->with('error', 'GitHub connection failed.');
        }
    }

    public function linkRepo(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'installation_id' => ['required', 'integer'],
            'github_repo_id' => ['required', 'integer'],
            'domain_url' => ['required', 'string', 'max:500'],
        ]);

        try {
            $repo = $this->security->linkRepo(
                $user,
                (int) $validated['installation_id'],
                (int) $validated['github_repo_id'],
                (string) $validated['domain_url'],
            );

            $this->audits->writeSafe([
                'action' => 'github.repo_link',
                'actor' => $user->toAuthUser(),
                'entityType' => 'github_repo',
                'entityId' => (string) $repo->id,
                'summary' => "{$user->name} linked {$repo->full_name} → {$repo->domain_url}",
                'metadata' => [
                    'fullName' => $repo->full_name,
                    'domainUrl' => $repo->domain_url,
                ],
                'request' => $request,
            ]);

            return redirect()->route('security')->with('flash', "Linked {$repo->full_name}.");
        } catch (StatusException $error) {
            return redirect()->route('security')->with('error', $error->getMessage());
        } catch (Throwable $error) {
            Log::error('GitHub repo link failed: '.$error->getMessage());

            return redirect()->route('security')->with('error', 'Could not link repository.');
        }
    }

    public function updateRepo(Request $request, int $repo): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'domain_url' => ['required', 'string', 'max:500'],
            'scan_on_push' => ['sometimes', 'boolean'],
        ]);

        try {
            $linked = $this->security->updateLinkedRepo(
                $user,
                $repo,
                (string) $validated['domain_url'],
                $request->boolean('scan_on_push'),
            );

            return redirect()->route('security')->with('flash', "Updated {$linked->full_name}.");
        } catch (StatusException $error) {
            return redirect()->route('security')->with('error', $error->getMessage());
        }
    }

    public function unlinkRepo(Request $request, int $repo): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        try {
            $this->security->unlinkRepo($user, $repo);

            return redirect()->route('security')->with('flash', 'Repository unlinked.');
        } catch (StatusException $error) {
            return redirect()->route('security')->with('error', $error->getMessage());
        }
    }

    public function scanNow(Request $request, int $repo): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        try {
            $scan = $this->security->runManualScan($user, $repo);

            return redirect()->route('security')->with(
                'flash',
                "Scan finished: {$scan->status} — {$scan->summary}"
            );
        } catch (StatusException $error) {
            return redirect()->route('security')->with('error', $error->getMessage());
        } catch (Throwable $error) {
            Log::error('Manual security scan failed: '.$error->getMessage());

            return redirect()->route('security')->with('error', 'Scan failed.');
        }
    }
}
