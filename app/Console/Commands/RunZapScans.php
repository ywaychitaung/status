<?php

namespace App\Console\Commands;

use App\Models\SecurityScan;
use App\Models\ZapScanRun;
use App\Services\MonitorService;
use App\Services\ZapScanner;
use App\Services\ZapScanService;
use Illuminate\Console\Command;
use Throwable;

class RunZapScans extends Command
{
    protected $signature = 'status:zap-scan
                            {--monitor= : Optional monitor id to scan}
                            {--run= : Existing zap_scan_runs id to execute}
                            {--source=zap_weekly : Scan source label (zap_weekly|manual_trigger)}';

    protected $description = 'Run OWASP ZAP baseline scans against active monitor domains and store encrypted results';

    public function handle(ZapScanService $scans, ZapScanner $zap): int
    {
        set_time_limit(0);

        $runIdOption = $this->option('run');
        $trackedRunId = is_numeric($runIdOption) && (int) $runIdOption > 0
            ? (int) $runIdOption
            : null;

        if ($trackedRunId !== null) {
            $scans->touchWorkerHeartbeat($trackedRunId);
            register_shutdown_function(function () use ($trackedRunId): void {
                try {
                    $run = ZapScanRun::query()->find($trackedRunId);
                    if (
                        $run instanceof ZapScanRun
                        && $run->is_active
                        && $run->status === ZapScanRun::STATUS_RUNNING
                    ) {
                        $run->markFailed('ZAP worker terminated unexpectedly. Check storage/logs/zap-scan.log.');
                    }
                } catch (Throwable) {
                    // Ignore shutdown cleanup failures.
                }
            });
        }

        if (! $zap->dockerAvailable()) {
            $message = 'Docker is not available. Install Docker and pull the ZAP image first (see scripts/install-zap.sh).';
            $this->failTrackedRun($trackedRunId, $message);
            $this->components->error($message);

            return self::FAILURE;
        }

        $sourceOption = $this->option('source');
        $source = is_string($sourceOption) && $sourceOption !== ''
            ? $sourceOption
            : SecurityScan::SOURCE_WEEKLY;

        try {
            if ($trackedRunId !== null) {
                $checked = $scans->executeRun($trackedRunId, $source);
                if ($checked === 0) {
                    $run = ZapScanRun::query()->find($trackedRunId);
                    $detail = $run?->error ?: 'No monitors were scanned. Check storage/logs/laravel.log for per-site errors.';
                    $this->components->error("ZAP run finished with 0 results: {$detail}");

                    return self::FAILURE;
                }

                $this->components->info(
                    $checked === 1 ? 'Scanned 1 monitor with OWASP ZAP.' : "Scanned {$checked} monitors with OWASP ZAP."
                );

                return self::SUCCESS;
            }

            $monitorId = $this->option('monitor');
            if (is_string($monitorId) && $monitorId !== '') {
                $monitors = app(MonitorService::class)->listActive();
                $match = collect($monitors)->firstWhere('id', $monitorId);
                if ($match === null) {
                    $this->components->error("Active monitor not found: {$monitorId}");

                    return self::FAILURE;
                }

                $scan = $scans->scanMonitor($match, isset($match['userId']) ? (int) $match['userId'] : null, $source);
                $this->components->info("Scanned {$scan->domain_url}: {$scan->status} — {$scan->summary}");

                return self::SUCCESS;
            }

            $checked = $scans->scanAllActive();
        } catch (Throwable $error) {
            $this->failTrackedRun($trackedRunId, $error->getMessage());
            $this->components->error('ZAP scan run failed: '.$error->getMessage());

            return self::FAILURE;
        }

        $this->components->info(
            $checked === 1 ? 'Scanned 1 monitor with OWASP ZAP.' : "Scanned {$checked} monitors with OWASP ZAP."
        );

        return self::SUCCESS;
    }

    private function failTrackedRun(?int $runId, string $message): void
    {
        if ($runId === null) {
            return;
        }

        $run = ZapScanRun::query()->find($runId);
        if ($run instanceof ZapScanRun && $run->is_active && $run->status === ZapScanRun::STATUS_RUNNING) {
            $run->markFailed($message);
        }
    }
}
