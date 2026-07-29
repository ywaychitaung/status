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

        'discord_webhook_url' => env('ALERT_DISCORD_WEBHOOK_URL'),
        'telegram_bot_token' => env('ALERT_TELEGRAM_BOT_TOKEN'),
        'telegram_chat_id' => env('ALERT_TELEGRAM_CHAT_ID'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Field encryption
    |--------------------------------------------------------------------------
    |
    | 32-byte (64 hex character) key for AES-256-GCM field encryption and the
    | HMAC-SHA256 blind indexes. Generate with: openssl rand -hex 32
    |
    | When absent, the key is read from (or generated into) the app_settings
    | table, matching the legacy Deno behaviour.
    |
    */

    'encryption_key' => env('ENCRYPTION_KEY'),

    /*
    |--------------------------------------------------------------------------
    | Password hashing
    |--------------------------------------------------------------------------
    |
    | Driver used when creating or updating passwords:
    |   - argon2id (default) — custom format compatible with the Deno app
    |   - bcrypt — PHP password_hash(PASSWORD_BCRYPT)
    |
    | Existing hashes of either format still verify; users are rehashed to
    | the active driver on successful login or password change.
    |
    */

    'password' => [
        'hash_driver' => env('HASH_DRIVER', 'argon2id'),
        'bcrypt_rounds' => (int) env('BCRYPT_ROUNDS', 12),
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
        'audits' => '/audits',
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
        'password' => 'password',
    ],

];
