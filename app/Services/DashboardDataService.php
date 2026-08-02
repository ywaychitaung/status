<?php

namespace App\Services;

use App\Models\User;
use App\Support\DashboardDatetime;
use App\Support\PageMeta;
use Illuminate\Http\Request;

/** Port of _legacy/lib/pageData.ts + getDashboardFrame from dashboardAuth.ts. */
class DashboardDataService
{
    public function __construct(
        private readonly CheckService $checks,
        private readonly MonitorService $monitors,
        private readonly AuditService $audits,
        private readonly AlertSettingsService $alertSettings,
        private readonly ZapScanService $zapScans,
    ) {}

    /**
     * Chrome fields shared by every dashboard page.
     *
     * @param  array{statuses: array<int, array<string, mixed>>}|null  $snapshot
     * @return array<string, mixed>
     */
    public function frame(?array $snapshot = null): array
    {
        $snapshot ??= $this->checks->snapshot();
        $timezone = DashboardDatetime::timezoneConfig();

        $total = count($snapshot['statuses']);
        $downCount = count(array_filter(
            $snapshot['statuses'],
            fn (array $status): bool => ! $status['up']
        ));
        $allUp = $downCount === 0 && $total > 0;

        $healthLabel = match (true) {
            $allUp => 'All systems operational',
            $downCount === 1 => '1 service is down',
            default => "{$downCount} services are down",
        };

        return [
            'healthLabel' => $healthLabel,
            'allUp' => $allUp,
            'timezoneName' => $timezone['name'],
            'timezoneUtcLabel' => $timezone['utc_label'],
            'timezoneId' => $timezone['id'],
            'timestamp' => DashboardDatetime::format(DashboardDatetime::nowIso()),
        ];
    }

    /** @return array<string, mixed> */
    public function publicPage(Request $request, string $path): array
    {
        $snapshot = $this->checks->snapshot();

        return [
            'path' => PageMeta::normalizePath($path),
            'meta' => PageMeta::forPath($path),
            'frame' => $this->frame($snapshot),
            'snapshot' => $snapshot,
            'user' => $this->authUser($request),
        ];
    }

    /** @return array<string, mixed> */
    public function adminPage(Request $request): array
    {
        $path = '/admin';
        $userId = $this->userId($request);
        $snapshot = $this->checks->snapshot($userId);

        return [
            'path' => $path,
            'meta' => PageMeta::forPath($path),
            'frame' => $this->frame($snapshot),
            'user' => $this->authUser($request),
            'monitors' => $userId === null ? [] : $this->monitors->listActive($userId),
            'inactiveMonitors' => $userId === null ? [] : $this->monitors->listInactive($userId),
            'flash' => $this->flash($request, 'flash'),
            'error' => $this->flash($request, 'error'),
            'editingId' => $this->flash($request, 'edit'),
        ];
    }

    /** @return array<string, mixed> */
    public function auditsPage(Request $request): array
    {
        $path = '/audits';

        return [
            'path' => $path,
            'meta' => PageMeta::forPath($path),
            'frame' => $this->frame(),
            'user' => $this->authUser($request),
            'audits' => $this->audits->list(100),
        ];
    }

    /** @return array<string, mixed> */
    public function alertsPage(Request $request): array
    {
        $path = '/alerts';
        $userId = $this->userId($request);
        $snapshot = $this->checks->snapshot($userId);

        return [
            'path' => $path,
            'meta' => PageMeta::forPath($path),
            'frame' => $this->frame($snapshot),
            'user' => $this->authUser($request),
            'settings' => $userId === null
                ? ['discordWebhookUrl' => '', 'telegramBotToken' => '', 'telegramChatId' => '']
                : $this->alertSettings->toForm($userId),
            'flash' => $this->flash($request, 'flash'),
            'error' => $this->flash($request, 'error'),
        ];
    }

    /** @return array<string, mixed> */
    public function securityPage(Request $request): array
    {
        $path = '/security';
        /** @var User|null $user */
        $user = $request->user();
        $userId = $this->userId($request);
        $snapshot = $this->checks->snapshot($userId);
        $security = $this->zapScans->pageData($user instanceof User ? $user : null);

        return [
            'path' => $path,
            'meta' => PageMeta::forPath($path),
            'frame' => $this->frame($snapshot),
            'user' => $this->authUser($request),
            ...$security,
            'flash' => $this->flash($request, 'flash'),
            'error' => $this->flash($request, 'error'),
        ];
    }

    /** @return array<string, mixed>|null */
    public function securityScanPage(Request $request, int $scanId): ?array
    {
        $userId = $this->userId($request);
        if ($userId === null) {
            return null;
        }

        $scan = $this->zapScans->findForUser($scanId, $userId);
        if ($scan === null) {
            return null;
        }

        $snapshot = $this->checks->snapshot($userId);

        return [
            'path' => '/security',
            'meta' => [
                'active' => 'security',
                'title' => 'Scan details',
                'subtitle' => 'OWASP ZAP baseline findings and remediation guidance',
            ],
            'frame' => $this->frame($snapshot),
            'user' => $this->authUser($request),
            'scan' => $scan->toArrayForUi(includeDetails: true),
        ];
    }

    /** @return array<string, mixed> */
    public function accountPage(Request $request): array
    {
        $path = '/account';

        return [
            'path' => $path,
            'meta' => PageMeta::forPath($path),
            'frame' => $this->frame(),
            'user' => $this->authUser($request),
            'flash' => $this->flash($request, 'flash'),
            'error' => $this->flash($request, 'error'),
        ];
    }

    /** @return array<string, mixed>|null */
    private function authUser(Request $request): ?array
    {
        $user = $request->user();

        return $user instanceof User ? $user->toAuthUser() : null;
    }

    private function userId(Request $request): ?int
    {
        $user = $request->user();

        return $user instanceof User ? (int) $user->id : null;
    }

    /** Prefer the session flash bag, falling back to legacy query parameters. */
    private function flash(Request $request, string $key): ?string
    {
        $fromSession = $request->session()->get($key);
        if (is_string($fromSession) && $fromSession !== '') {
            return $fromSession;
        }

        $fromQuery = $request->query($key);

        return is_string($fromQuery) && $fromQuery !== '' ? $fromQuery : null;
    }
}
