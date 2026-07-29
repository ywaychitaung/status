<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Postgres LISTEN/NOTIFY fan-out for live dashboard updates
 * (_legacy/lib/db.ts + _legacy/lib/statusEvents.ts).
 */
class StatusEvents
{
    public const CHANNEL = 'status_update';

    /** Best-effort: a failed NOTIFY must never break the caller. */
    public function notifyUpdate(): void
    {
        try {
            DB::statement('NOTIFY '.self::CHANNEL);
        } catch (Throwable $error) {
            Log::warning('Status NOTIFY failed: '.$error->getMessage());
        }
    }

    /**
     * Opens a dedicated connection that LISTENs on the status channel.
     *
     * Returns null when the pgsql extension is unavailable or the connection
     * fails, in which case callers should fall back to polling.
     *
     * @return resource|null
     */
    public function openListener()
    {
        if (! function_exists('pg_connect')) {
            return null;
        }

        try {
            $connection = @pg_connect($this->connectionString());
        } catch (Throwable $error) {
            Log::warning('Postgres LISTEN connection failed: '.$error->getMessage());

            return null;
        }

        if ($connection === false) {
            return null;
        }

        $result = @pg_query($connection, 'LISTEN '.self::CHANNEL);
        if ($result === false) {
            @pg_close($connection);

            return null;
        }

        return $connection;
    }

    /**
     * @param  resource  $connection
     */
    public function hasNotification($connection): bool
    {
        $received = false;

        // Drain every queued notification so a burst collapses into one push.
        while (@pg_get_notify($connection, PGSQL_ASSOC) !== false) {
            $received = true;
        }

        return $received;
    }

    /**
     * @param  resource  $connection
     */
    public function closeListener($connection): void
    {
        @pg_close($connection);
    }

    private function connectionString(): string
    {
        $config = config('database.connections.'.config('database.default'));

        $parts = [
            'host' => $config['host'] ?? '127.0.0.1',
            'port' => $config['port'] ?? 5432,
            'dbname' => $config['database'] ?? '',
            'user' => $config['username'] ?? '',
            'password' => $config['password'] ?? '',
        ];

        if (! empty($config['sslmode'])) {
            $parts['sslmode'] = $config['sslmode'];
        }

        return implode(' ', array_map(
            fn (string $key, mixed $value): string => $key."='".addslashes((string) $value)."'",
            array_keys($parts),
            $parts
        ));
    }
}
