/** Apply baseline browser security headers to every response. */
export function applySecurityHeaders(response: Response): void {
  const headers = response.headers;
  const contentType = headers.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html");

  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );

  if (isHtml) {
    // Fresh's own CSP middleware defaults to 'unsafe-inline' for scripts because
    // Vite island modules (`/@id/fresh-island::…`) and the bootstrap graph need
    // it. A nonce-only script-src breaks island hydration in Fresh+Vite.
    headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "img-src 'self' data:",
        "font-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline'",
        // SSE (`/api/stream`) + Vite HMR websocket in dev
        "connect-src 'self' ws: wss:",
        "object-src 'none'",
        "upgrade-insecure-requests",
      ].join("; "),
    );
  }

  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("X-DNS-Prefetch-Control", "off");
}
