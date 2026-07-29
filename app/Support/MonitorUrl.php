<?php

namespace App\Support;

use InvalidArgumentException;

/** Port of normalizeMonitorUrl from _legacy/lib/monitor.ts. */
class MonitorUrl
{
    private const DEFAULT_PORTS = ['http' => 80, 'https' => 443];

    public static function normalize(string $raw): string
    {
        $trimmed = trim($raw);

        if ($trimmed === '') {
            throw new InvalidArgumentException('URL is required');
        }

        $withProtocol = preg_match('#^https?://#i', $trimmed) ? $trimmed : 'https://'.$trimmed;

        $parts = parse_url($withProtocol);
        if ($parts === false || empty($parts['host'])) {
            throw new InvalidArgumentException('URL is not valid');
        }

        $scheme = strtolower($parts['scheme'] ?? '');
        if ($scheme !== 'http' && $scheme !== 'https') {
            throw new InvalidArgumentException('URL must use http or https');
        }

        $origin = $scheme.'://'.strtolower($parts['host']);
        $port = $parts['port'] ?? null;
        if ($port !== null && $port !== self::DEFAULT_PORTS[$scheme]) {
            $origin .= ':'.$port;
        }

        $rawPath = $parts['path'] ?? '';
        $path = ($rawPath === '' || $rawPath === '/')
            ? ''
            : rtrim($rawPath, '/');

        $query = isset($parts['query']) && $parts['query'] !== '' ? '?'.$parts['query'] : '';

        return $origin.$path.$query;
    }

    public static function isHttpUrl(string $value): bool
    {
        return (bool) preg_match('#^https?://#i', $value);
    }
}
