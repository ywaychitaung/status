<?php

namespace App\Services;

use App\Models\AppSummary;
use App\Models\Incident;
use App\Models\MonitorStatus;
use App\Support\DashboardDatetime;
use App\Support\MonitorUrl;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/** Port of _legacy/lib/checks.ts. */
class CheckService
{
    public function __construct(
        private readonly MonitorService $monitors,
        private readonly AlertService $alerts,
        private readonly StatusEvents $events,
    ) {}

    /** Probe every active monitor, persist results, and fan out alerts. */
    public function runChecks(): int
    {
        $now = DashboardDatetime::nowIso();
        $summary = $this->summary();
        $monitors = $this->monitors->listActive();
        $checked = 0;

        foreach ($monitors as $monitor) {
            $outcome = $this->checkMonitor($monitor, $now, touchSummary: false);

            if ($outcome === null) {
                continue;
            }

            if ($outcome['becameDown']) {
                $summary['lastOutageAt'] = $now;
            }

            $checked++;
        }

        DB::table('app_summary')
            ->where('id', AppSummary::SINGLETON_ID)
            ->update([
                'updated_at' => $now,
                'last_outage_at' => $summary['lastOutageAt'],
            ]);

        $this->events->notifyUpdate();

        return $checked;
    }

    /**
     * Probe one monitor immediately (e.g. right after create/reactivate)
     * and write website_statuses so the UI is not stuck on "No checks yet".
     *
     * @param  array{id: string, name: string, url: string}  $monitor
     * @return array{up: bool, statusCode: int|null, responseTimeMs: int|null, error: string|null, becameDown: bool}|null
     */
    public function checkMonitor(array $monitor, ?string $now = null, bool $touchSummary = true): ?array
    {
        $now ??= DashboardDatetime::nowIso();

        try {
            $url = $this->resolveMonitorUrl($monitor['url']);
        } catch (Throwable $error) {
            Log::error("Skipping monitor {$monitor['id']}: ".$error->getMessage());

            return null;
        }

        $result = $this->checkUrl($url);
        $previousUp = $this->previousUp($monitor['id']);
        $becameDown = $previousUp !== false && $result['up'] === false;
        $becameUp = $previousUp === false && $result['up'] === true;

        if ($becameDown) {
            $this->openIncident($monitor['id'], $monitor['name'], $url, $now, $result);
        } elseif (! $result['up']) {
            $this->openIncident($monitor['id'], $monitor['name'], $url, $now, $result);
        } elseif ($becameUp) {
            $this->resolveIncident($monitor['id'], $now);
        }

        $status = [
            'id' => $monitor['id'],
            'name' => $monitor['name'],
            'url' => $url,
            'checkedAt' => $now,
            ...$result,
        ];

        $this->persistStatus($monitor['id'], $monitor['name'], $url, $now, $result);

        $this->alerts->notifyStatusChange(
            ['id' => $monitor['id'], 'name' => $monitor['name'], 'url' => $url],
            $status,
            $previousUp
        );

        if ($touchSummary) {
            $summaryUpdate = ['updated_at' => $now];

            if ($becameDown) {
                $summaryUpdate['last_outage_at'] = $now;
            }

            DB::table('app_summary')
                ->where('id', AppSummary::SINGLETON_ID)
                ->update($summaryUpdate);

            $this->events->notifyUpdate();
        }

        return $result + ['becameDown' => $becameDown];
    }

    /**
     * @return array{statuses: array<int, array<string, mixed>>, summary: array<string, string|null>, incidents: array<int, array<string, mixed>>}
     */
    public function snapshot(?int $userId = null): array
    {
        $monitors = $this->monitors->listActive($userId);

        $rows = MonitorStatus::query()
            ->get(['monitor_id', 'up', 'checked_at', 'status_code', 'response_time_ms', 'error'])
            ->keyBy('monitor_id');

        $statuses = [];

        foreach ($monitors as $monitor) {
            $row = $rows->get($monitor['id']);

            if ($row === null) {
                $statuses[] = [
                    'id' => $monitor['id'],
                    'name' => $monitor['name'],
                    'url' => $monitor['url'],
                    'up' => false,
                    'checkedAt' => '',
                    'statusCode' => null,
                    'responseTimeMs' => null,
                    'error' => 'No checks yet',
                ];

                continue;
            }

            $statuses[] = [
                'id' => $monitor['id'],
                'name' => $monitor['name'],
                'url' => $monitor['url'],
                'up' => (bool) $row->up,
                'checkedAt' => DashboardDatetime::toIso($row->checked_at) ?? '',
                'statusCode' => $row->status_code === null ? null : (int) $row->status_code,
                'responseTimeMs' => $row->response_time_ms === null ? null : (int) $row->response_time_ms,
                'error' => $row->error,
            ];
        }

        return [
            'statuses' => $statuses,
            'summary' => $this->summary(),
            'incidents' => $this->incidentHistory(),
        ];
    }

    /**
     * @return array{up: bool, statusCode: int|null, responseTimeMs: int|null, error: string|null}
     */
    public function checkUrl(string $url): array
    {
        $startedAt = hrtime(true);

        try {
            $response = Http::withHeaders(['user-agent' => (string) config('status.monitor.user_agent')])
                ->timeout((int) config('status.monitor.timeout_seconds'))
                ->withOptions(['allow_redirects' => true])
                ->get($url);

            $responseTimeMs = $this->elapsedMs($startedAt);
            $statusCode = $response->status();
            $up = $statusCode >= 200 && $statusCode < 400;

            return [
                'up' => $up,
                'statusCode' => $statusCode,
                'responseTimeMs' => $responseTimeMs,
                'error' => $up ? null : "Unexpected status {$statusCode}",
            ];
        } catch (Throwable $error) {
            return [
                'up' => false,
                'statusCode' => null,
                'responseTimeMs' => $this->elapsedMs($startedAt),
                'error' => $error->getMessage(),
            ];
        }
    }

    /** @return array{updatedAt: string, lastOutageAt: string|null} */
    public function summary(): array
    {
        $row = DB::table('app_summary')
            ->where('id', AppSummary::SINGLETON_ID)
            ->first(['updated_at', 'last_outage_at']);

        return [
            'updatedAt' => DashboardDatetime::toIso($row->updated_at ?? null) ?? DashboardDatetime::nowIso(),
            'lastOutageAt' => DashboardDatetime::toIso($row->last_outage_at ?? null),
        ];
    }

    /** @return array<int, array<string, mixed>> */
    public function incidentHistory(): array
    {
        return Incident::query()
            ->recentFirst()
            ->limit((int) config('status.incident_history_limit'))
            ->get()
            ->map(fn (Incident $incident): array => $incident->toRecord())
            ->all();
    }

    /** Guarantee a usable plaintext URL (Eloquent list already decrypts). */
    private function resolveMonitorUrl(string $url): string
    {
        if (MonitorUrl::isHttpUrl($url)) {
            return $url;
        }

        try {
            $plain = Crypt::decryptString($url);
            if (MonitorUrl::isHttpUrl($plain)) {
                return $plain;
            }
        } catch (Throwable) {
            // Fall through.
        }

        throw new RuntimeException('Monitor URL is not usable: '.substr($url, 0, 48));
    }

    private function previousUp(string $monitorId): ?bool
    {
        $row = DB::table('website_statuses')
            ->where('monitor_id', $monitorId)
            ->first(['up']);

        return $row === null ? null : (bool) $row->up;
    }

    /**
     * @param  array{statusCode: int|null, error: string|null}  $result
     */
    private function openIncident(
        string $monitorId,
        string $name,
        string $url,
        string $now,
        array $result
    ): void {
        $open = Incident::query()
            ->where('monitor_id', $monitorId)
            ->whereNull('resolved_at')
            ->first();

        if ($open !== null) {
            $open->status_code = $result['statusCode'];
            $open->error = $result['error'];
            $open->save();

            return;
        }

        Incident::query()->create([
            'id' => "{$monitorId}-{$now}",
            'monitor_id' => $monitorId,
            'name' => $name,
            'url' => $url,
            'started_at' => $now,
            'resolved_at' => null,
            'status_code' => $result['statusCode'],
            'error' => $result['error'],
        ]);

        $this->trimIncidentHistory();
    }

    private function trimIncidentHistory(): void
    {
        DB::statement(
            'DELETE FROM incidents WHERE id IN (
                SELECT id FROM incidents
                ORDER BY COALESCE(resolved_at, started_at) DESC
                OFFSET ?
            )',
            [(int) config('status.incident_history_limit')]
        );
    }

    private function resolveIncident(string $monitorId, string $now): void
    {
        DB::table('incidents')
            ->where('monitor_id', $monitorId)
            ->whereNull('resolved_at')
            ->update(['resolved_at' => $now]);
    }

    /**
     * @param  array{up: bool, statusCode: int|null, responseTimeMs: int|null, error: string|null}  $result
     */
    private function persistStatus(
        string $monitorId,
        string $name,
        string $url,
        string $now,
        array $result
    ): void {
        // upsert() bypasses Eloquent casts — encrypt explicitly.
        DB::table('website_statuses')->upsert(
            [[
                'monitor_id' => $monitorId,
                'name' => Crypt::encryptString($name),
                'url' => Crypt::encryptString($url),
                'up' => $result['up'],
                'checked_at' => $now,
                'status_code' => $result['statusCode'],
                'response_time_ms' => $result['responseTimeMs'],
                'error' => $result['error'] === null ? null : Crypt::encryptString($result['error']),
            ]],
            ['monitor_id'],
            ['name', 'url', 'up', 'checked_at', 'status_code', 'response_time_ms', 'error']
        );
    }

    private function elapsedMs(int|float $startedAt): int
    {
        return (int) round((hrtime(true) - $startedAt) / 1_000_000);
    }
}
