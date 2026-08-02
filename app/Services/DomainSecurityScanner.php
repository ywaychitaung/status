<?php

namespace App\Services;

use App\Models\SecurityScan;
use Illuminate\Support\Facades\Http;
use Throwable;

/** Probe a public website domain for TLS + security-header hygiene. */
class DomainSecurityScanner
{
    /** @var list<string> */
    private const IMPORTANT_HEADERS = [
        'strict-transport-security',
        'content-security-policy',
        'x-content-type-options',
        'x-frame-options',
        'referrer-policy',
        'permissions-policy',
    ];

    /**
     * @return array{status: string, summary: string, details: array<string, mixed>}
     */
    public function scan(string $domainUrl): array
    {
        $normalized = $this->normalizeUrl($domainUrl);
        if ($normalized === null) {
            return [
                'status' => SecurityScan::STATUS_FAIL,
                'summary' => 'Invalid domain URL.',
                'details' => [
                    'domainUrl' => $domainUrl,
                    'checks' => [],
                    'error' => 'Could not parse domain URL.',
                ],
            ];
        }

        $checks = [];
        $failCount = 0;
        $warnCount = 0;

        $httpsCheck = $this->checkHttps($normalized);
        $checks[] = $httpsCheck;
        $this->tally($httpsCheck['status'], $failCount, $warnCount);

        $tlsCheck = $this->checkTls($normalized);
        $checks[] = $tlsCheck;
        $this->tally($tlsCheck['status'], $failCount, $warnCount);

        $headersCheck = $this->checkSecurityHeaders($normalized);
        $checks[] = $headersCheck;
        $this->tally($headersCheck['status'], $failCount, $warnCount);

        $status = match (true) {
            $failCount > 0 => SecurityScan::STATUS_FAIL,
            $warnCount > 0 => SecurityScan::STATUS_WARN,
            default => SecurityScan::STATUS_PASS,
        };

        $summary = match ($status) {
            SecurityScan::STATUS_PASS => 'Domain security checks passed.',
            SecurityScan::STATUS_WARN => 'Domain reachable with security warnings.',
            default => 'Domain security checks failed.',
        };

        return [
            'status' => $status,
            'summary' => $summary,
            'details' => [
                'domainUrl' => $normalized,
                'checkedAt' => now()->toIso8601String(),
                'checks' => $checks,
            ],
        ];
    }

    private function normalizeUrl(string $value): ?string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (! preg_match('#^https?://#i', $trimmed)) {
            $trimmed = 'https://'.$trimmed;
        }

        $parts = parse_url($trimmed);
        if (! is_array($parts) || empty($parts['host'])) {
            return null;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? 'https'));
        if (! in_array($scheme, ['http', 'https'], true)) {
            return null;
        }

        $host = strtolower((string) $parts['host']);
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';
        $path = $parts['path'] ?? '/';

        return $scheme.'://'.$host.$port.($path === '' ? '/' : $path);
    }

    /**
     * @return array{id: string, label: string, status: string, message: string, meta?: array<string, mixed>}
     */
    private function checkHttps(string $url): array
    {
        $scheme = parse_url($url, PHP_URL_SCHEME);
        if ($scheme !== 'https') {
            return [
                'id' => 'https',
                'label' => 'HTTPS',
                'status' => SecurityScan::STATUS_FAIL,
                'message' => 'URL must use https://',
            ];
        }

        try {
            $response = Http::timeout(12)
                ->withHeaders(['User-Agent' => (string) config('status.monitor.user_agent')])
                ->withOptions(['allow_redirects' => true, 'verify' => true])
                ->get($url);

            if ($response->successful() || ($response->status() >= 300 && $response->status() < 400)) {
                return [
                    'id' => 'https',
                    'label' => 'HTTPS',
                    'status' => SecurityScan::STATUS_PASS,
                    'message' => 'HTTPS endpoint responded (HTTP '.$response->status().').',
                    'meta' => ['httpStatus' => $response->status()],
                ];
            }

            return [
                'id' => 'https',
                'label' => 'HTTPS',
                'status' => SecurityScan::STATUS_WARN,
                'message' => 'HTTPS responded with HTTP '.$response->status().'.',
                'meta' => ['httpStatus' => $response->status()],
            ];
        } catch (Throwable $error) {
            return [
                'id' => 'https',
                'label' => 'HTTPS',
                'status' => SecurityScan::STATUS_FAIL,
                'message' => 'HTTPS request failed: '.$error->getMessage(),
            ];
        }
    }

    /**
     * @return array{id: string, label: string, status: string, message: string, meta?: array<string, mixed>}
     */
    private function checkTls(string $url): array
    {
        $host = parse_url($url, PHP_URL_HOST);
        $port = parse_url($url, PHP_URL_PORT) ?: 443;
        if (! is_string($host) || $host === '') {
            return [
                'id' => 'tls',
                'label' => 'TLS certificate',
                'status' => SecurityScan::STATUS_FAIL,
                'message' => 'Missing host for TLS check.',
            ];
        }

        try {
            $context = stream_context_create([
                'ssl' => [
                    'capture_peer_cert' => true,
                    'verify_peer' => true,
                    'verify_peer_name' => true,
                    'SNI_enabled' => true,
                ],
            ]);

            $client = @stream_socket_client(
                "ssl://{$host}:{$port}",
                $errno,
                $errstr,
                12,
                STREAM_CLIENT_CONNECT,
                $context
            );

            if ($client === false) {
                return [
                    'id' => 'tls',
                    'label' => 'TLS certificate',
                    'status' => SecurityScan::STATUS_FAIL,
                    'message' => "TLS connection failed: {$errstr}",
                ];
            }

            $params = stream_context_get_params($client);
            fclose($client);

            $cert = $params['options']['ssl']['peer_certificate'] ?? null;
            if ($cert === null) {
                return [
                    'id' => 'tls',
                    'label' => 'TLS certificate',
                    'status' => SecurityScan::STATUS_FAIL,
                    'message' => 'Could not read peer certificate.',
                ];
            }

            $parsed = openssl_x509_parse($cert);
            if ($parsed === false) {
                return [
                    'id' => 'tls',
                    'label' => 'TLS certificate',
                    'status' => SecurityScan::STATUS_FAIL,
                    'message' => 'Could not parse peer certificate.',
                ];
            }

            $validTo = isset($parsed['validTo_time_t']) ? (int) $parsed['validTo_time_t'] : 0;
            $daysLeft = $validTo > 0 ? (int) floor(($validTo - time()) / 86400) : -1;
            $issuer = is_array($parsed['issuer'] ?? null)
                ? (string) ($parsed['issuer']['O'] ?? $parsed['issuer']['CN'] ?? 'Unknown')
                : 'Unknown';

            $status = match (true) {
                $daysLeft < 0 => SecurityScan::STATUS_FAIL,
                $daysLeft < 14 => SecurityScan::STATUS_WARN,
                default => SecurityScan::STATUS_PASS,
            };

            $message = match ($status) {
                SecurityScan::STATUS_FAIL => 'TLS certificate is expired.',
                SecurityScan::STATUS_WARN => "TLS certificate expires in {$daysLeft} days.",
                default => "TLS certificate valid ({$daysLeft} days remaining).",
            };

            return [
                'id' => 'tls',
                'label' => 'TLS certificate',
                'status' => $status,
                'message' => $message,
                'meta' => [
                    'issuer' => $issuer,
                    'daysRemaining' => $daysLeft,
                    'validTo' => $validTo > 0 ? gmdate('c', $validTo) : null,
                ],
            ];
        } catch (Throwable $error) {
            return [
                'id' => 'tls',
                'label' => 'TLS certificate',
                'status' => SecurityScan::STATUS_FAIL,
                'message' => 'TLS check failed: '.$error->getMessage(),
            ];
        }
    }

    /**
     * @return array{id: string, label: string, status: string, message: string, meta?: array<string, mixed>}
     */
    private function checkSecurityHeaders(string $url): array
    {
        try {
            $response = Http::timeout(12)
                ->withHeaders(['User-Agent' => (string) config('status.monitor.user_agent')])
                ->withOptions(['allow_redirects' => true, 'verify' => true])
                ->get($url);

            $present = [];
            $missing = [];
            foreach (self::IMPORTANT_HEADERS as $header) {
                if ($response->header($header) !== '') {
                    $present[] = $header;
                } else {
                    $missing[] = $header;
                }
            }

            $status = match (true) {
                count($missing) === 0 => SecurityScan::STATUS_PASS,
                count($present) === 0 => SecurityScan::STATUS_FAIL,
                default => SecurityScan::STATUS_WARN,
            };

            return [
                'id' => 'headers',
                'label' => 'Security headers',
                'status' => $status,
                'message' => count($missing) === 0
                    ? 'All recommended security headers present.'
                    : 'Missing headers: '.implode(', ', $missing),
                'meta' => [
                    'present' => $present,
                    'missing' => $missing,
                ],
            ];
        } catch (Throwable $error) {
            return [
                'id' => 'headers',
                'label' => 'Security headers',
                'status' => SecurityScan::STATUS_FAIL,
                'message' => 'Header check failed: '.$error->getMessage(),
            ];
        }
    }

    private function tally(string $status, int &$failCount, int &$warnCount): void
    {
        if ($status === SecurityScan::STATUS_FAIL) {
            $failCount++;
        } elseif ($status === SecurityScan::STATUS_WARN) {
            $warnCount++;
        }
    }
}
