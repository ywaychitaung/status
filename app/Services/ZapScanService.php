<?php

namespace App\Services;

use App\Exceptions\StatusException;
use App\Models\SecurityScan;
use App\Models\User;
use App\Models\ZapScanRun;
use Illuminate\Support\Facades\Log;
use Throwable;

/** OWASP ZAP baseline scans against active monitor (websites) domains. */
class ZapScanService
{
    /** Auto-fail runs stuck longer than this (seconds). */
    private const STALE_AFTER_SECONDS = 7200;

    public function __construct(
        private readonly ZapScanner $zap,
        private readonly MonitorService $monitors,
        private readonly AuditService $audits,
    ) {}

    /**
     * @return array{
     *   scans: list<array<string, mixed>>,
     *   zapReady: bool,
     *   monitorCount: int,
     *   activeRun: array<string, mixed>|null
     * }
     */
    public function pageData(?User $user = null): array
    {
        if ($user !== null) {
            $this->expireStaleRunsForUser((int) $user->id);
        }

        $userId = $user instanceof User ? (int) $user->id : null;

        $scansQuery = SecurityScan::query()->orderByDesc('scanned_at')->limit(100);
        if ($userId !== null) {
            $scansQuery->where('user_id', $userId);
        }

        $scans = $scansQuery
            ->get()
            ->map(fn (SecurityScan $scan): array => $scan->toArrayForUi(includeDetails: false))
            ->values()
            ->all();

        $activeRun = null;
        if ($userId !== null) {
            $run = $this->activeRunForUser($userId);
            $activeRun = $run?->toArrayForUi();
        }

        return [
            'scans' => $scans,
            'zapReady' => $this->zap->dockerAvailable(),
            'monitorCount' => count($this->monitors->listActive($userId)),
            'activeRun' => $activeRun,
        ];
    }

    /** Load one scan owned by the user (full details for the detail page). */
    public function findForUser(int $scanId, int $userId): ?SecurityScan
    {
        return SecurityScan::query()
            ->whereKey($scanId)
            ->where('user_id', $userId)
            ->first();
    }

    public function activeRunForUser(int $userId): ?ZapScanRun
    {
        $this->expireStaleRunsForUser($userId);

        return ZapScanRun::query()
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->where('status', ZapScanRun::STATUS_RUNNING)
            ->orderByDesc('id')
            ->first();
    }

    /** Create a run row and spawn a detached artisan worker. */
    public function startManualScan(User $user): ZapScanRun
    {
        if (! $this->zap->dockerAvailable()) {
            throw new StatusException('Docker / OWASP ZAP is not available on this server.');
        }

        if ($this->activeRunForUser((int) $user->id) !== null) {
            throw new StatusException('A ZAP scan is already running. Please wait for it to finish.');
        }

        $monitors = $this->monitors->listActive((int) $user->id);
        if ($monitors === []) {
            throw new StatusException('No active websites to scan.');
        }

        $run = ZapScanRun::query()->create([
            'user_id' => $user->id,
            'is_active' => true,
            'status' => ZapScanRun::STATUS_RUNNING,
            'monitors_total' => count($monitors),
            'monitors_completed' => 0,
            'started_at' => now(),
            'finished_at' => null,
            'error' => null,
        ]);

        $this->audits->writeSafe([
            'action' => 'zap.manual_trigger',
            'actor' => $user->toAuthUser(),
            'entityType' => 'zap_scan',
            'entityId' => (string) $run->id,
            'summary' => "{$user->name} started a manual OWASP ZAP scan ({$run->monitors_total} websites)",
            'metadata' => [
                'source' => SecurityScan::SOURCE_MANUAL,
                'runId' => (int) $run->id,
                'monitorsTotal' => (int) $run->monitors_total,
            ],
        ]);

        $this->spawnBackgroundWorker((int) $run->id, (int) $user->id, SecurityScan::SOURCE_MANUAL);

        return $run;
    }

    /** Execute scans for a persisted run (called from artisan). */
    public function executeRun(int $runId, ?string $source = null): int
    {
        $run = ZapScanRun::query()->find($runId);
        if ($run === null) {
            throw new StatusException("Zap scan run {$runId} not found.");
        }

        $userId = $run->user_id === null ? null : (int) $run->user_id;
        $normalizedSource = $this->normalizeSource($source);
        $monitors = $this->monitors->listActive($userId);
        $run->monitors_total = count($monitors);
        $run->monitors_completed = 0;
        $run->status = ZapScanRun::STATUS_RUNNING;
        $run->is_active = true;
        $run->save();

        $scanned = 0;

        try {
            foreach ($monitors as $monitor) {
                try {
                    $ownerId = $userId ?? (isset($monitor['userId']) ? (int) $monitor['userId'] : null);
                    $this->scanMonitor($monitor, $ownerId, $normalizedSource);
                    $scanned++;
                } catch (Throwable $error) {
                    Log::error("ZAP scan failed for monitor {$monitor['id']}: ".$error->getMessage());
                }

                $run->monitors_completed = $scanned;
                $run->save();
            }

            $run->markCompleted();
        } catch (Throwable $error) {
            $run->markFailed($error->getMessage());
            throw $error;
        }

        return $scanned;
    }

    /** Probe every active website (scheduler / CLI without a run id). */
    public function scanAllActive(?int $userId = null): int
    {
        $monitors = $this->monitors->listActive($userId);

        $run = ZapScanRun::query()->create([
            'user_id' => $userId,
            'is_active' => true,
            'status' => ZapScanRun::STATUS_RUNNING,
            'monitors_total' => count($monitors),
            'monitors_completed' => 0,
            'started_at' => now(),
            'finished_at' => null,
            'error' => null,
        ]);

        $actor = null;
        if ($userId !== null) {
            $user = User::query()->find($userId);
            $actor = $user instanceof User ? $user->toAuthUser() : null;
        }

        $this->audits->writeSafe([
            'action' => 'zap.zap_weekly',
            'actor' => $actor,
            'actorUsername' => $actor === null ? 'scheduler' : null,
            'entityType' => 'zap_scan',
            'entityId' => (string) $run->id,
            'summary' => $actor === null
                ? "Scheduled OWASP ZAP weekly scan started ({$run->monitors_total} websites)"
                : "{$actor['name']} scheduled OWASP ZAP weekly scan started ({$run->monitors_total} websites)",
            'metadata' => [
                'source' => SecurityScan::SOURCE_WEEKLY,
                'runId' => (int) $run->id,
                'monitorsTotal' => (int) $run->monitors_total,
            ],
        ]);

        try {
            return $this->executeRun((int) $run->id, SecurityScan::SOURCE_WEEKLY);
        } catch (Throwable) {
            return (int) $run->fresh()?->monitors_completed;
        }
    }

    /**
     * @param  array{id: string, name: string, url: string, userId?: int}  $monitor
     */
    public function scanMonitor(
        array $monitor,
        ?int $userId = null,
        string $source = SecurityScan::SOURCE_WEEKLY,
    ): SecurityScan {
        $result = $this->zap->scan($monitor['url']);
        $ownerId = $userId ?? (isset($monitor['userId']) ? (int) $monitor['userId'] : null);
        $normalizedSource = $this->normalizeSource($source);

        return SecurityScan::query()->create([
            'user_id' => $ownerId,
            'monitor_id' => $monitor['id'],
            'source' => $normalizedSource,
            'engine' => SecurityScan::ENGINE_ZAP,
            'monitor_name' => $monitor['name'],
            'domain_url' => $monitor['url'],
            'status' => $result['status'],
            'summary' => $result['summary'],
            'details' => $result['details'],
            'alert_high' => $result['alertHigh'],
            'alert_medium' => $result['alertMedium'],
            'alert_low' => $result['alertLow'],
            'alert_info' => $result['alertInfo'],
            'exit_code' => $result['exitCode'],
            'scanned_at' => now(),
        ]);
    }

    private function normalizeSource(?string $source): string
    {
        return $source === SecurityScan::SOURCE_MANUAL
            ? SecurityScan::SOURCE_MANUAL
            : SecurityScan::SOURCE_WEEKLY;
    }

    private function spawnBackgroundWorker(int $runId, int $userId, string $source): void
    {
        $logFile = storage_path('logs/zap-scan.log');
        $command = sprintf(
            'nohup %s %s status:zap-scan --run=%d --source=%s >> %s 2>&1 & echo $!',
            escapeshellarg($this->phpCliBinary()),
            escapeshellarg(base_path('artisan')),
            $runId,
            escapeshellarg($source),
            escapeshellarg($logFile)
        );

        $pid = trim((string) shell_exec($command));

        Log::info('Starting background OWASP ZAP scan.', [
            'userId' => $userId,
            'runId' => $runId,
            'pid' => $pid !== '' ? $pid : null,
            'php' => $this->phpCliBinary(),
        ]);
    }

    private function expireStaleRunsForUser(int $userId): void
    {
        ZapScanRun::query()
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->where('status', ZapScanRun::STATUS_RUNNING)
            ->where('started_at', '<', now()->subSeconds(self::STALE_AFTER_SECONDS))
            ->each(function (ZapScanRun $run): void {
                $run->markFailed('Scan timed out (no completion within 2 hours).');
            });
    }

    /** PHP CLI binary — never php-fpm (PHP_BINARY under FPM points at the FPM SAPI). */
    private function phpCliBinary(): string
    {
        $candidates = [
            '/usr/bin/php8.4',
            '/usr/bin/php8.3',
            '/usr/bin/php8.2',
            '/usr/bin/php',
            'php',
        ];

        if (defined('PHP_BINARY') && is_string(PHP_BINARY) && PHP_BINARY !== '') {
            $base = basename(PHP_BINARY);
            if (! str_contains($base, 'php-fpm') && is_executable(PHP_BINARY)) {
                array_unshift($candidates, PHP_BINARY);
            }
        }

        foreach ($candidates as $candidate) {
            if (str_contains($candidate, '/') && is_executable($candidate)) {
                return $candidate;
            }

            $resolved = trim((string) shell_exec('command -v '.escapeshellarg($candidate).' 2>/dev/null'));
            if ($resolved !== '' && is_executable($resolved) && ! str_contains(basename($resolved), 'php-fpm')) {
                return $resolved;
            }
        }

        throw new \RuntimeException('PHP CLI binary not found. Install php-cli (e.g. php8.4-cli).');
    }
}
