<?php

return [

    /*
    |--------------------------------------------------------------------------
    | App metadata
    |--------------------------------------------------------------------------
    |
    | Ported from the legacy Deno implementation (_legacy/lib/constants.ts).
    |
    */

    'version' => '4.0.0',

    'name' => 'Status',

    'tagline' => 'Uptime Monitor',

    'description' => 'Personal website uptime monitoring with the Laravel scheduler, Postgres storage, and live SSE updates.',

    'author' => [
        'name' => 'Yway Chit Aung',
        'url' => 'https://ywaychitaung.dev',
        'email' => 'yca@duck.com',
    ],

    'support' => [
        'report_email' => 'yca@duck.com',
        'report_mailto' => 'mailto:yca@duck.com',
    ],

    /*
    |--------------------------------------------------------------------------
    | Dashboard timezone
    |--------------------------------------------------------------------------
    */

    'timezone' => [
        'id' => 'Asia/Singapore',
        'short' => 'SGT',
        'name' => 'Singapore Time',
        'utc_label' => 'UTC/GMT +8',
    ],

    /*
    |--------------------------------------------------------------------------
    | Monitoring engine
    |--------------------------------------------------------------------------
    */

    'monitor' => [
        'cron_expression' => '* * * * *',
        'interval_label' => 'Every 1 minute',
        'interval_minutes' => 1,
        'engine' => 'Laravel Scheduler',
        'storage' => 'Postgres',
        'stream' => 'SSE live',
        /** Per-request timeout, in seconds, when probing a monitored URL. */
        'timeout_seconds' => 10,
        'user_agent' => 'status-monitor/1.0',
    ],

    /*
    |--------------------------------------------------------------------------
    | OWASP ZAP (weekly domain security scans)
    |--------------------------------------------------------------------------
    |
    | Runs zap-baseline.py via Docker against every active monitor URL.
    | Default: Saturday 06:00 Asia/Singapore (UTC+8).
    | @see https://www.zaproxy.org/docs/docker/baseline-scan/
    |
    */

    'zap' => [
        'enabled' => (bool) env('ZAP_ENABLED', true),
        /** Cron in ZAP_TIMEZONE (minute hour dom month dow). 6 = Saturday. */
        'cron_expression' => env('ZAP_CRON', '0 6 * * 6'),
        'timezone' => env('ZAP_TIMEZONE', 'Asia/Singapore'),
        'schedule_label' => env('ZAP_SCHEDULE_LABEL', 'Every Saturday at 6:00 AM SGT'),
        'docker_image' => env('ZAP_DOCKER_IMAGE', 'ghcr.io/zaproxy/zaproxy:stable'),
        /** Minutes the ZAP spider is allowed to run per target. */
        'spider_minutes' => (int) env('ZAP_SPIDER_MINUTES', 1),
        /** Hard timeout for one docker scan process. */
        'timeout_seconds' => (int) env('ZAP_TIMEOUT_SECONDS', 900),
    ],

    /*
    |--------------------------------------------------------------------------
    | Alerting
    |--------------------------------------------------------------------------
    */

    'alerts' => [
        'on_down' => true,
        'on_recovery' => true,
        /** Minutes between repeated down alerts for the same monitor. */
        'down_interval_minutes' => 60,
        /** Consecutive failed checks before a down alert is sent. */
        'down_consecutive' => 5,
    ],

    /*
    |--------------------------------------------------------------------------
    | Theme
    |--------------------------------------------------------------------------
    */

    'theme' => [
        'storage_key' => 'theme',
        'shortcut_key' => 'd',
        'default_mode' => 'light',
    ],

    /*
    |--------------------------------------------------------------------------
    | Navigation links
    |--------------------------------------------------------------------------
    */

    'links' => [
        'home' => '/',
        'services' => '/services',
        'incidents' => '/incidents',
        'admin' => '/admin',
        'alerts' => '/alerts',
        'audits' => '/audits',
        'security' => '/security',
        'account' => '/account',
        'github' => 'https://github.com/ywaychitaung/status',
    ],

    /*
    |--------------------------------------------------------------------------
    | History + streaming limits
    |--------------------------------------------------------------------------
    */

    /** Max incident records retained (newest kept). */
    'incident_history_limit' => 50,

    'stream' => [
        /** Seconds between SSE heartbeat comments. */
        'heartbeat_seconds' => 25,
        /** Seconds between snapshot pushes when Postgres LISTEN is unavailable. */
        'poll_seconds' => 15,
        /**
         * Max seconds a single SSE connection is held open before the server
         * closes it; EventSource reconnects automatically. Set to 0 to keep
         * connections open indefinitely.
         */
        'max_seconds' => 900,
    ],

    /*
    |--------------------------------------------------------------------------
    | Default admin seed
    |--------------------------------------------------------------------------
    |
    | Inserted only when the users table is empty.
    |
    */

    'seed_admin' => [
        'name' => 'Admin',
        'username' => 'admin',
        'email' => 'admin@status.local',
        'password' => 'password',
    ],

];
