/**
 * Content-Security-Policy for HTML pages. Applied per request by middleware.ts
 * with a fresh nonce; Next.js reads the nonce from the request header and adds
 * it to every script it renders, so no inline script runs without it.
 *
 * Kept free of Node-only APIs: it runs in the middleware (edge) runtime.
 */

/** Third-party origins the app loads on purpose, per directive. */
export const CSP_SOURCES = {
  // Razorpay Checkout (loaded on demand on the billing page) and Cloudflare
  // Turnstile (auth pages, when configured). With 'strict-dynamic', browsers
  // trust scripts inserted by our nonced code; the hosts are a fallback for
  // older browsers.
  scripts: ["https://checkout.razorpay.com", "https://challenges.cloudflare.com"],
  frames: ["https://*.razorpay.com", "https://challenges.cloudflare.com"],
  connect: ["https://*.razorpay.com"],
  // Google profile pictures (Google sign-in) and Razorpay checkout assets.
  images: ["https://lh3.googleusercontent.com", "https://*.razorpay.com"],
  forms: ["https://*.razorpay.com"],
} as const;

export interface CspOptions {
  nonce: string;
  /** Development needs 'unsafe-eval' (React debugging) and websockets (hot reload). */
  dev?: boolean;
  /** Add upgrade-insecure-requests (only when the site is served over HTTPS). */
  upgradeInsecureRequests?: boolean;
  /** Optional endpoint that receives violation reports. */
  reportUri?: string;
}

export function buildContentSecurityPolicy({ nonce, dev = false, upgradeInsecureRequests = false, reportUri }: CspOptions): string {
  const directives: [string, ...string[]][] = [
    ["default-src", "'self'"],
    ["script-src", "'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...CSP_SOURCES.scripts, ...(dev ? ["'unsafe-eval'"] : [])],
    // Inline styles are needed by React style props, Radix positioning and toasts.
    // Style injection is far less dangerous than script injection, which stays nonce-only.
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "data:", "blob:", ...CSP_SOURCES.images],
    ["font-src", "'self'", "data:"],
    ["connect-src", "'self'", ...CSP_SOURCES.connect, ...(dev ? ["ws:", "wss:"] : [])],
    ["frame-src", ...CSP_SOURCES.frames],
    ["worker-src", "'self'", "blob:"],
    ["manifest-src", "'self'"],
    ["media-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'", ...CSP_SOURCES.forms],
    ["frame-ancestors", "'none'"],
  ];
  if (upgradeInsecureRequests) directives.push(["upgrade-insecure-requests"]);
  if (reportUri && /^https:\/\/[^\s;,]+$/.test(reportUri)) directives.push(["report-uri", reportUri]);
  return directives.map((parts) => parts.join(" ")).join("; ");
}

/** 128-bit random nonce, base64 encoded (Web Crypto, works in every runtime). */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
