<?php

namespace App\Services;

use App\Models\AlertChannel;
use App\Support\DashboardDatetime;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Port of _legacy/lib/notify.ts. */
class AlertService
{
    /**
     * @param  array{id: string, name: string, url: string}  $monitor
     * @param  array{up: bool, checkedAt: string, statusCode: int|null, responseTimeMs: int|null, error: string|null}  $next
     */
    public function notifyStatusChange(array $monitor, array $next, ?bool $previousUp): void
    {
        $onDown = (bool) config('status.alerts.on_down');
        $onRecovery = (bool) config('status.alerts.on_recovery');
        $downConsecutive = (int) config('status.alerts.down_consecutive');
        $downIntervalMinutes = (int) config('status.alerts.down_interval_minutes');

        $isRecoveryTransition = $previousUp === false && $next['up'] === true;

        $this->ensureAlertState($monitor['id']);

        if (! $next['up']) {
            $row = DB::selectOne(
                'UPDATE alert_states SET consecutive_downs = consecutive_downs + 1
                 WHERE monitor_id = ? RETURNING consecutive_downs',
                [$monitor['id']]
            );
            $consecutive = $row === null ? 1 : (int) $row->consecutive_downs;

            if (! $onDown || $consecutive < $downConsecutive) {
                return;
            }

            // Claim the send slot in one statement so overlapping scheduler ticks
            // cannot each fire a webhook in the same throttle window.
            $now = now();
            $claimed = DB::table('alert_states')
                ->where('monitor_id', $monitor['id'])
                ->where(function ($query) use ($now, $downIntervalMinutes): void {
                    $query->whereNull('last_down_alert_at')
                        ->orWhere('last_down_alert_at', '<=', $now->copy()->subMinutes($downIntervalMinutes));
                })
                ->update(['last_down_alert_at' => $now]);

            if ($claimed === 0) {
                return;
            }

            $this->dispatch($this->buildMessage($monitor, $next, $previousUp, $consecutive));

            return;
        }

        $consecutive = (int) (DB::table('alert_states')
            ->where('monitor_id', $monitor['id'])
            ->value('consecutive_downs') ?? 0);
        $wasConfirmedDown = $consecutive >= $downConsecutive;

        DB::table('alert_states')
            ->where('monitor_id', $monitor['id'])
            ->update(['consecutive_downs' => 0, 'last_down_alert_at' => null]);

        if (! $wasConfirmedDown || ! $isRecoveryTransition || ! $onRecovery) {
            return;
        }

        $this->dispatch($this->buildMessage($monitor, $next, $previousUp));
    }

    private function ensureAlertState(string $monitorId): void
    {
        DB::table('alert_states')->insertOrIgnore([
            'monitor_id' => $monitorId,
            'consecutive_downs' => 0,
        ]);
    }

    /**
     * @param  array{id: string, name: string, url: string}  $monitor
     * @param  array{up: bool, checkedAt: string, statusCode: int|null, responseTimeMs: int|null, error: string|null}  $next
     */
    private function buildMessage(
        array $monitor,
        array $next,
        ?bool $previousUp,
        ?int $consecutiveDowns = null
    ): string {
        $state = $next['up'] ? 'RECOVERED' : 'DOWN';
        $transition = match (true) {
            $previousUp === null => 'Initial check',
            $previousUp === $next['up'] => 'No state change',
            default => 'State changed',
        };

        $lines = [
            "Uptime alert: {$monitor['name']} is {$state}",
            'URL: '.$monitor['url'],
            'Status code: '.($next['statusCode'] ?? 'N/A'),
            'Latency: '.($next['responseTimeMs'] === null ? 'N/A' : $next['responseTimeMs'].' ms'),
            'Error: '.($next['error'] ?? 'None'),
            'Checked at: '.DashboardDatetime::format($next['checkedAt']),
            'Timezone: '.config('status.timezone.id'),
            'Transition: '.$transition,
        ];

        if (! $next['up'] && $consecutiveDowns !== null) {
            $lines[] = 'Consecutive failures: '.$consecutiveDowns;
        }

        return implode("\n", $lines);
    }

    private function dispatch(string $message): void
    {
        $this->sendDiscord($message);
        $this->sendTelegram($message);
    }

    private function sendDiscord(string $text): void
    {
        $channel = AlertChannel::findByName(AlertChannel::NAME_DISCORD);
        $webhook = trim((string) ($channel?->webhook_url ?? ''));
        if ($webhook === '') {
            return;
        }

        try {
            $response = Http::asJson()->timeout(10)->post($webhook, ['content' => $text]);

            if ($response->failed()) {
                Log::error('Discord notification failed: '.$response->status());
            }
        } catch (Throwable $error) {
            Log::error('Discord notification failed: '.$error->getMessage());
        }
    }

    private function sendTelegram(string $text): void
    {
        $channel = AlertChannel::findByName(AlertChannel::NAME_TELEGRAM);
        $token = trim((string) ($channel?->bot_token ?? ''));
        $chatId = trim((string) ($channel?->chat_id ?? ''));

        if ($token === '' || $chatId === '') {
            return;
        }

        try {
            $response = Http::asJson()
                ->timeout(10)
                ->post("https://api.telegram.org/bot{$token}/sendMessage", [
                    'chat_id' => $chatId,
                    'text' => $text,
                    'disable_web_page_preview' => true,
                ]);

            if ($response->failed()) {
                Log::error('Telegram notification failed: '.$response->status());
            }
        } catch (Throwable $error) {
            Log::error('Telegram notification failed: '.$error->getMessage());
        }
    }
}
