<?php

namespace App\Support;

/** Port of _legacy/lib/pageMeta.ts. */
class PageMeta
{
    /** @var array<string, array{active: string, title: string, subtitle: string}> */
    private const META = [
        '/' => [
            'active' => 'dashboard',
            'title' => 'Dashboard',
            'subtitle' => 'Overview of monitored websites and live health',
        ],
        '/services' => [
            'active' => 'services',
            'title' => 'Services',
            'subtitle' => 'All monitored endpoints and latest check results',
        ],
        '/incidents' => [
            'active' => 'incidents',
            'title' => 'Incidents',
            'subtitle' => 'Active outages and recovery timeline',
        ],
        '/admin' => [
            'active' => 'admin',
            'title' => 'Admin',
            'subtitle' => 'Manage monitored websites',
        ],
        '/alerts' => [
            'active' => 'alerts',
            'title' => 'Alerts',
            'subtitle' => 'Discord and Telegram notification channels',
        ],
        '/audits' => [
            'active' => 'audits',
            'title' => 'Audits',
            'subtitle' => 'Login, logout, account, and website change history',
        ],
        '/account' => [
            'active' => 'account',
            'title' => 'Account',
            'subtitle' => 'Update your profile and sign-in credentials',
        ],
    ];

    /** Strip query/hash and map unknown paths back to the dashboard root. */
    public static function normalizePath(string $path): string
    {
        $withoutHash = explode('#', $path)[0];
        $withoutQuery = explode('?', $withoutHash)[0];
        $trimmed = strlen($withoutQuery) > 1 ? rtrim($withoutQuery, '/') : $withoutQuery;
        $candidate = $trimmed === '' ? '/' : $trimmed;

        return array_key_exists($candidate, self::META) ? $candidate : '/';
    }

    /** @return array{active: string, title: string, subtitle: string} */
    public static function forPath(string $path): array
    {
        return self::META[self::normalizePath($path)];
    }

    public static function navIdForPath(string $path): string
    {
        return self::forPath($path)['active'];
    }
}
