import "server-only";
import { ApiError } from "@/lib/api";
import { getTurnstileConfig, isTurnstileMisconfigured } from "@/lib/config";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Widget actions; a token is only accepted by the form it was issued for. */
export type BotCheckAction = "signup" | "login" | "forgot_password";

interface SiteverifyResponse {
  success?: boolean;
  action?: string;
  "error-codes"?: string[];
}

function failed(): ApiError {
  return new ApiError(400, "BOT_CHECK_FAILED", "The security check failed or expired. Please try again.");
}

/**
 * Server-side Turnstile verification for the forms that send emails or check
 * passwords. A no-op when Turnstile isn't configured. Fails closed: if
 * Cloudflare can't be reached, the request is refused rather than let through.
 */
export async function verifyHuman(
  token: string | undefined,
  options: { action: BotCheckAction; ip?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (isTurnstileMisconfigured()) {
    console.error("[turnstile] set both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, or neither");
    throw new ApiError(503, "BOT_CHECK_MISCONFIGURED", "Sign-in protection is misconfigured on this server. Please contact support.");
  }
  const config = getTurnstileConfig();
  if (!config) return;
  if (!token) throw new ApiError(400, "BOT_CHECK_REQUIRED", "Please complete the security check and try again.");

  const body = new URLSearchParams({ secret: config.secretKey, response: token });
  if (options.ip && options.ip !== "unknown") body.set("remoteip", options.ip);

  let result: SiteverifyResponse;
  try {
    const response = await fetchImpl(SITEVERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`siteverify responded with ${response.status}`);
    result = (await response.json()) as SiteverifyResponse;
  } catch (error) {
    console.error("[turnstile] verification unavailable:", error instanceof Error ? error.message : error);
    throw new ApiError(503, "BOT_CHECK_UNAVAILABLE", "We couldn't run the security check. Please try again in a moment.");
  }

  if (result.success !== true) throw failed();
  // Cloudflare's test keys return no action; real tokens carry the widget's action.
  if (result.action && result.action !== options.action) throw failed();
}
