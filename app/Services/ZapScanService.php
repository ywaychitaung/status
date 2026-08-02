<?php

namespace App\Services;

use App\Models\SecurityScan;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Daily OWASP ZAP baseline scans against active monitor (websites) domains. */
class ZapScanService
{
    public function __construct(
        private readonly ZapScanner $zap,
        private readonly MonitorService $monitors,
    ) {}

    /**
     * @return array{scans: list<array<string, mixed>>, zapReady: bool, monitorCount: int}
     */
    public function pageData(): array
    {
        $scans = SecurityScan::query()
            ->orderByDesc('scanned_at')
            ->limit(100)
            ->get()
            ->map(fn (SecurityScan $scan): array => $scan->toArrayForUi())
            ->values()
            ->all();

        return [
            'scans' => $scans,
            'zapReady' => $this->zap->dockerAvailable(),
            'monitorCount' => count($this->monitors->listActive()),
        ];
    }

    /** Start a full scan in a detached artisan process (ZAP takes minutes). */
    public function startAfterResponse(?int $userId = null): void
    {
        $logFile = storage_path('logs/zap-scan.log');
        $command = sprintf(
            'nohup %s %s status:zap-scan >> %s 2>&1 &',
            escapeshellarg(PHP_BINARY),
            escapeshellarg(base_path('artisan')),
            escapeshellarg($logFile)
        );

        Log::info('Starting background OWASP ZAP scan.', [
            'userId' => $userId,
            'command' => $command,
        ]);

        exec($command);
    }

    /** Probe every active website and persist encrypted scan rows. */
    public function scanAllActive(?int $userId = null): int
    {
        $userId ??= User::query()->orderBy('id')->value('id');
        $monitors = $this->monitors->listActive();
        $scanned = 0;

        foreach ($monitors as $monitor) {
            try {
                $this->scanMonitor($monitor, $userId === null ? null : (int) $userId);
                $scanned++;
            } catch (Throwable $error) {
                Log::error("ZAP scan failed for monitor {$monitor['id']}: ".$error->getMessage());
            }
        }

        return $scanned;
    }

    /**
     * @param  array{id: string, name: string, url: string}  $monitor
     */
    public function scanMonitor(array $monitor, ?int $userId = null): SecurityScan
    {
        $result = $this->zap->scan($monitor['url']);

        return SecurityScan::query()->create([
            'user_id' => $userId,
            'monitor_id' => $monitor['id'],
            'source' => 'zap_weekly',
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
}
