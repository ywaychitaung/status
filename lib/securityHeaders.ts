/** Fresh stores the render nonce on the Response under this symbol. */
const FRESH_NONCE = Symbol.for("__freshNonce");

/** Apply baseline browser security headers to every response. */
export function applySecurityHeaders(response: Response): void {
  const headers = response.headers;
  const nonce = (response as Response & { [FRESH_NONCE]?: string })[FRESH_NONCE];
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}'`
    : "script-src 'self' 'unsafe-inline'";

  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
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
      scriptSrc,
      "connect-src 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  );
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  headers.set("X-DNS-Prefetch-Control", "off");
}
