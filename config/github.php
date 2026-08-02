<?php

return [

    /*
    |--------------------------------------------------------------------------
    | GitHub App (customer repo security scans)
    |--------------------------------------------------------------------------
    |
    | Create a GitHub App, set webhook URL to /api/github/webhook, and subscribe
    | to push + installation events. Users install the app from /security.
    |
    */

    'app_id' => env('GITHUB_APP_ID'),

    'client_id' => env('GITHUB_APP_CLIENT_ID'),

    'client_secret' => env('GITHUB_APP_CLIENT_SECRET'),

    'slug' => env('GITHUB_APP_SLUG'),

    /**
     * PEM contents (use \n for newlines) or absolute path to a .pem file.
     */
    'private_key' => env('GITHUB_APP_PRIVATE_KEY'),

    'webhook_secret' => env('GITHUB_APP_WEBHOOK_SECRET'),

];
