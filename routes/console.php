<?php

use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Scheduled monitoring
|--------------------------------------------------------------------------
|
| Replaces Deno.cron from the legacy app. Requires a single cron entry:
|   * * * * * cd /path/to/status && php artisan schedule:run >> /dev/null 2>&1
|
*/

Schedule::command('status:check')
    ->cron((string) config('status.monitor.cron_expression'))
    ->withoutOverlapping()
    ->runInBackground();

if (config('status.zap.enabled')) {
    Schedule::command('status:zap-scan')
        ->cron((string) config('status.zap.cron_expression'))
        ->timezone((string) config('status.zap.timezone'))
        ->withoutOverlapping()
        ->runInBackground();
}
