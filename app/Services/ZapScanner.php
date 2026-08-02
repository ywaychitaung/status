<?php

namespace App\Services;

use App\Models\SecurityScan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;
use Throwable;

/**
 * Run an OWASP ZAP baseline scan via Docker and normalize the JSON report.
 *
 * @see https://www.zaproxy.org/docs/docker/baseline-scan/
 */
class ZapScanner
{
    /**
     * @return array{
     *   status: string,
     *   summary: string,
     *   details: array<string, mixed>,
     *   alertHigh: int,
     *   alertMedium: int,
     *   alertLow: int,
     *   alertInfo: int,
     *   exitCode: int|null
     * }
     */
    public function scan(string $domainUrl): array
    {
        $normalized = $this->normalizeUrl($domainUrl);
        if ($normalized === null) {
            return $this->failureResult($domainUrl, 'Invalid domain URL.', null);
        }

        if (! $this->dockerAvailable()) {
            return $this->failureResult($normalized, 'Docker is not available for OWASP ZAP scans.', null);
        }

        $workDir = storage_path('app/zap/'.Str::lower((string) Str::ulid()));
        File::ensureDirectoryExists($workDir, 0777);
        @chmod($workDir, 0777);

        $reportName = 'report.json';
        $reportPath = $workDir.DIRECTORY_SEPARATOR.$reportName;
        $image = (string) config('status.zap.docker_image');
        $minutes = max(1, (int) config('status.zap.spider_minutes'));
        $timeout = max(120, (int) config('status.zap.timeout_seconds'));

        try {
            // Do not allocate a TTY (`-t`) — it hangs under PHP-FPM / Process.
            $result = Process::timeout($timeout)
                ->run([
                    'docker', 'run', '--rm',
                    '-v', $workDir.':/zap/wrk/:rw',
                    $image,
                    'zap-baseline.py',
                    '-t', $normalized,
                    '-m', (string) $minutes,
                    '-J', $reportName,
                    '-I',
                ]);

            $exitCode = $result->exitCode();
            $report = $this->readReport($reportPath);
            $counts = $this->countAlerts($report);
            $findings = $this->summarizeFindings($report);
            $status = $this->statusFrom($counts, $exitCode);
            $summary = $this->summaryFrom($status, $counts, $exitCode, $result->errorOutput() ?: $result->output());

            return [
                'status' => $status,
                'summary' => $summary,
                'details' => [
                    'engine' => 'owasp_zap',
                    'domainUrl' => $normalized,
                    'checkedAt' => now()->toIso8601String(),
                    'exitCode' => $exitCode,
                    'spiderMinutes' => $minutes,
                    'alerts' => [
                        'high' => $counts['high'],
                        'medium' => $counts['medium'],
                        'low' => $counts['low'],
                        'informational' => $counts['info'],
                    ],
                    'findings' => $findings,
                    // Shape the Security UI already renders for domain scans.
                    'checks' => array_map(static fn (array $finding): array => [
                        'id' => $finding['pluginId'] ?? $finding['name'],
                        'label' => $finding['name'],
                        'status' => match ($finding['risk']) {
                            'High' => SecurityScan::STATUS_FAIL,
                            'Medium' => SecurityScan::STATUS_WARN,
                            default => SecurityScan::STATUS_PASS,
                        },
                        'message' => $finding['risk'].' ×'.$finding['count'].($finding['description'] !== '' ? ' — '.Str::limit($finding['description'], 240, '…') : ''),
                        'meta' => $finding,
                    ], $findings),
                ],
                'alertHigh' => $counts['high'],
                'alertMedium' => $counts['medium'],
                'alertLow' => $counts['low'],
                'alertInfo' => $counts['info'],
                'exitCode' => $exitCode,
            ];
        } catch (Throwable $error) {
            Log::error('OWASP ZAP scan failed: '.$error->getMessage());

            return $this->failureResult($normalized, 'ZAP scan failed: '.$error->getMessage(), null);
        } finally {
            File::deleteDirectory($workDir);
        }
    }

    public function dockerAvailable(): bool
    {
        try {
            return Process::timeout(5)->run(['docker', 'version', '--format', '{{.Server.Version}}'])->successful();
        } catch (Throwable) {
            return false;
        }
    }

    private function normalizeUrl(string $value): ?string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (! preg_match('#^https?://#i', $trimmed)) {
            $trimmed = 'https://'.$trimmed;
        }

        $parts = parse_url($trimmed);
        if (! is_array($parts) || empty($parts['host'])) {
            return null;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? 'https'));
        if (! in_array($scheme, ['http', 'https'], true)) {
            return null;
        }

        $host = strtolower((string) $parts['host']);
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';
        $path = $parts['path'] ?? '/';

        return $scheme.'://'.$host.$port.($path === '' ? '/' : $path);
    }

    /**
     * @return array{high: int, medium: int, low: int, info: int}
     */
    private function countAlerts(?array $report): array
    {
        $counts = ['high' => 0, 'medium' => 0, 'low' => 0, 'info' => 0];

        foreach ($this->alerts($report) as $alert) {
            $risk = (int) ($alert['riskcode'] ?? $alert['riskCode'] ?? -1);
            $count = max(1, (int) ($alert['count'] ?? 1));

            match ($risk) {
                3 => $counts['high'] += $count,
                2 => $counts['medium'] += $count,
                1 => $counts['low'] += $count,
                0 => $counts['info'] += $count,
                default => null,
            };
        }

        return $counts;
    }

    /**
     * @return list<array{name: string, risk: string, count: int, pluginId: string, description: string, solution: string, reference: string}>
     */
    private function summarizeFindings(?array $report): array
    {
        $findings = [];

        foreach ($this->alerts($report) as $alert) {
            $riskCode = (int) ($alert['riskcode'] ?? $alert['riskCode'] ?? -1);
            $risk = match ($riskCode) {
                3 => 'High',
                2 => 'Medium',
                1 => 'Low',
                0 => 'Informational',
                default => 'Unknown',
            };

            $desc = html_entity_decode(strip_tags((string) ($alert['desc'] ?? $alert['description'] ?? '')), ENT_QUOTES | ENT_HTML5);
            $desc = preg_replace('/\s+/', ' ', trim($desc)) ?? '';

            $solution = html_entity_decode(strip_tags((string) ($alert['solution'] ?? '')), ENT_QUOTES | ENT_HTML5);
            $solution = preg_replace('/\s+/', ' ', trim($solution)) ?? '';

            $reference = html_entity_decode(strip_tags((string) ($alert['reference'] ?? '')), ENT_QUOTES | ENT_HTML5);
            $reference = preg_replace('/\s+/', ' ', trim($reference)) ?? '';

            $findings[] = [
                'name' => (string) ($alert['name'] ?? $alert['alert'] ?? 'Alert'),
                'risk' => $risk,
                'count' => max(1, (int) ($alert['count'] ?? 1)),
                'pluginId' => (string) ($alert['pluginid'] ?? $alert['pluginId'] ?? $alert['alertRef'] ?? ''),
                'description' => Str::limit($desc, 4000, '…'),
                'solution' => Str::limit($solution, 4000, '…'),
                'reference' => Str::limit($reference, 2000, '…'),
            ];
        }

        usort($findings, static function (array $a, array $b): int {
            $rank = ['High' => 0, 'Medium' => 1, 'Low' => 2, 'Informational' => 3, 'Unknown' => 4];

            return ($rank[$a['risk']] ?? 9) <=> ($rank[$b['risk']] ?? 9)
                ?: $b['count'] <=> $a['count'];
        });

        return array_slice($findings, 0, 80);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function alerts(?array $report): array
    {
        if ($report === null) {
            return [];
        }

        $alerts = [];
        $sites = $report['site'] ?? [];
        if (! is_array($sites)) {
            return [];
        }

        foreach ($sites as $site) {
            if (! is_array($site)) {
                continue;
            }
            foreach (($site['alerts'] ?? []) as $alert) {
                if (is_array($alert)) {
                    $alerts[] = $alert;
                }
            }
        }

        return $alerts;
    }

    /** @return array<string, mixed>|null */
    private function readReport(string $path): ?array
    {
        if (! is_file($path)) {
            return null;
        }

        $raw = file_get_contents($path);
        if ($raw === false || $raw === '') {
            return null;
        }

        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @param  array{high: int, medium: int, low: int, info: int}  $counts
     */
    private function statusFrom(array $counts, ?int $exitCode): string
    {
        if ($counts['high'] > 0 || $exitCode === 1) {
            return SecurityScan::STATUS_FAIL;
        }

        if ($counts['medium'] > 0 || $exitCode === 2) {
            return SecurityScan::STATUS_WARN;
        }

        if ($exitCode === 3) {
            return SecurityScan::STATUS_FAIL;
        }

        return SecurityScan::STATUS_PASS;
    }

    /**
     * @param  array{high: int, medium: int, low: int, info: int}  $counts
     */
    private function summaryFrom(string $status, array $counts, ?int $exitCode, string $output): string
    {
        if ($exitCode === 3) {
            $snippet = Str::limit(trim(preg_replace('/\s+/', ' ', $output) ?? ''), 160, '…');

            return $snippet !== '' ? "ZAP scanner error: {$snippet}" : 'ZAP scanner failed (exit 3).';
        }

        return sprintf(
            'ZAP baseline (%s): %d high, %d medium, %d low, %d info',
            $status,
            $counts['high'],
            $counts['medium'],
            $counts['low'],
            $counts['info'],
        );
    }

    /**
     * @return array{
     *   status: string,
     *   summary: string,
     *   details: array<string, mixed>,
     *   alertHigh: int,
     *   alertMedium: int,
     *   alertLow: int,
     *   alertInfo: int,
     *   exitCode: int|null
     * }
     */
    private function failureResult(string $domainUrl, string $message, ?int $exitCode): array
    {
        return [
            'status' => SecurityScan::STATUS_FAIL,
            'summary' => $message,
            'details' => [
                'engine' => 'owasp_zap',
                'domainUrl' => $domainUrl,
                'checkedAt' => now()->toIso8601String(),
                'error' => $message,
                'checks' => [[
                    'id' => 'zap',
                    'label' => 'OWASP ZAP',
                    'status' => SecurityScan::STATUS_FAIL,
                    'message' => $message,
                ]],
            ],
            'alertHigh' => 0,
            'alertMedium' => 0,
            'alertLow' => 0,
            'alertInfo' => 0,
            'exitCode' => $exitCode,
        ];
    }
}
