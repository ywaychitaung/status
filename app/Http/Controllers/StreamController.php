<?php

namespace App\Http\Controllers;

use App\Services\CheckService;
use App\Services\StatusEvents;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/**
 * Server-Sent Events feed of dashboard snapshots
 * (port of _legacy/routes/api/stream.ts).
 *
 * Pushes a snapshot immediately, then on every Postgres NOTIFY. When LISTEN is
 * unavailable it falls back to polling. A heartbeat comment keeps proxies from
 * closing the connection.
 */
class StreamController extends Controller
{
    private const TICK_MICROSECONDS = 250_000;

    public function __invoke(CheckService $checks, StatusEvents $events): StreamedResponse
    {
        $heartbeatSeconds = (int) config('status.stream.heartbeat_seconds');
        $pollSeconds = (int) config('status.stream.poll_seconds');
        $maxSeconds = (int) config('status.stream.max_seconds');

        $response = new StreamedResponse(function () use (
            $checks,
            $events,
            $heartbeatSeconds,
            $pollSeconds,
            $maxSeconds
        ): void {
            @set_time_limit(0);
            ignore_user_abort(false);

            while (ob_get_level() > 0) {
                ob_end_flush();
            }

            $startedAt = microtime(true);
            $lastHeartbeat = $startedAt;
            $lastPoll = $startedAt;

            $this->pushSnapshot($checks);

            $listener = $events->openListener();

            try {
                while (! connection_aborted()) {
                    usleep(self::TICK_MICROSECONDS);
                    $nowSeconds = microtime(true);

                    if ($listener !== null && $events->hasNotification($listener)) {
                        $this->pushSnapshot($checks);
                        $lastPoll = $nowSeconds;
                    }

                    if ($listener === null && $nowSeconds - $lastPoll >= $pollSeconds) {
                        $this->pushSnapshot($checks);
                        $lastPoll = $nowSeconds;
                    }

                    if ($nowSeconds - $lastHeartbeat >= $heartbeatSeconds) {
                        $this->write(": ping\n\n");
                        $lastHeartbeat = $nowSeconds;
                    }

                    // EventSource reconnects on its own, so capping the
                    // connection lifetime keeps workers from being pinned.
                    if ($maxSeconds > 0 && $nowSeconds - $startedAt >= $maxSeconds) {
                        break;
                    }
                }
            } finally {
                if ($listener !== null) {
                    $events->closeListener($listener);
                }
            }
        });

        $response->headers->set('Content-Type', 'text/event-stream; charset=utf-8');
        $response->headers->set('Cache-Control', 'no-cache, no-transform');
        $response->headers->set('Connection', 'keep-alive');
        $response->headers->set('X-Accel-Buffering', 'no');

        return $response;
    }

    private function pushSnapshot(CheckService $checks): void
    {
        try {
            $this->write($this->event('snapshot', $checks->snapshot()));
        } catch (Throwable $error) {
            Log::error('SSE snapshot push failed: '.$error->getMessage());
        }
    }

    private function event(string $name, mixed $data): string
    {
        return "event: {$name}\ndata: ".json_encode($data, JSON_UNESCAPED_SLASHES)."\n\n";
    }

    private function write(string $payload): void
    {
        echo $payload;
        flush();
    }
}
