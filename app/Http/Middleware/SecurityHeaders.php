<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Baseline browser security headers (port of _legacy/lib/securityHeaders.ts). */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        return self::apply($next($request));
    }

    /**
     * Also called from the exception handler, because responses rendered from
     * exceptions bypass the middleware stack on the way out.
     */
    public static function apply(Response $response): Response
    {
        $headers = $response->headers;
        $isHtml = str_contains((string) $headers->get('content-type'), 'text/html');

        if (! app()->environment('local')) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        if ($isHtml) {
            $headers->set('Content-Security-Policy', implode('; ', self::contentSecurityPolicy()));
        }

        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $headers->set(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
        );
        $headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        $headers->set('Cross-Origin-Resource-Policy', 'same-origin');
        $headers->set('X-DNS-Prefetch-Control', 'off');

        return $response;
    }

    /** @return list<string> */
    private static function contentSecurityPolicy(): array
    {
        $scriptSrc = ["'self'", "'unsafe-inline'"];
        $connectSrc = ["'self'", 'ws:', 'wss:'];
        $styleSrc = ["'self'", "'unsafe-inline'"];
        $fontSrc = ["'self'"];

        // Vite HMR — use IPv4 only; browsers reject http://[::1]:5173 in CSP lists.
        if (app()->environment('local')) {
            $viteOrigins = [
                'http://localhost:5173',
                'http://127.0.0.1:5173',
            ];
            array_push($scriptSrc, ...$viteOrigins);
            array_push($styleSrc, ...$viteOrigins);
            array_push($fontSrc, ...$viteOrigins);
            array_push($connectSrc, ...$viteOrigins);
            foreach ($viteOrigins as $origin) {
                $connectSrc[] = str_replace('http://', 'ws://', $origin);
            }
        }

        $directives = [
            "default-src 'self'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "img-src 'self' data:",
            'font-src '.implode(' ', $fontSrc),
            'style-src '.implode(' ', $styleSrc),
            'script-src '.implode(' ', $scriptSrc),
            // SSE (/api/stream) + the Vite HMR websocket in development.
            'connect-src '.implode(' ', $connectSrc),
            "object-src 'none'",
        ];

        if (! app()->environment('local')) {
            $directives[] = 'upgrade-insecure-requests';
        }

        return $directives;
    }
}
