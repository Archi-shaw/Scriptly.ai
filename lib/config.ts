import "server-only";

/**
 * Centralised, server-only access to environment configuration.
 * Values are read lazily so tests and scripts can set env vars before use.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function readInt(name: string, fallback: number, min: number, max: number): number {
  const raw = read(name);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export const isProduction = () => process.env.NODE_ENV === "production";

export function getMongoUri(): string | undefined {
  // MONGODB_URL is accepted for backwards compatibility with earlier setups.
  return read("MONGODB_URI") ?? read("MONGODB_URL");
}

export function getAuthSecret(): string {
  const secret = read("NEXTAUTH_SECRET") ?? read("AUTH_SECRET");
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not configured");
  }
  return secret;
}

export const authConfig = {
  otpTtlMinutes: () => readInt("OTP_TTL_MINUTES", 10, 2, 60),
  otpMaxAttempts: () => readInt("OTP_MAX_ATTEMPTS", 5, 3, 10),
  otpResendCooldownSeconds: () => readInt("OTP_RESEND_COOLDOWN_SECONDS", 60, 15, 600),
  otpMaxSends: () => readInt("OTP_MAX_SENDS", 5, 1, 10),
  sessionMaxAgeDays: () => readInt("SESSION_MAX_AGE_DAYS", 7, 1, 90),
};

export function getGoogleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = read("GOOGLE_CLIENT_ID");
  const clientSecret = read("GOOGLE_CLIENT_SECRET");
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  /** Refuse to send unless the connection is upgraded with STARTTLS (protects credentials and codes). */
  requireTLS: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export function getSmtpConfig(): SmtpConfig | null {
  const host = read("SMTP_HOST");
  if (!host) return null;
  const port = readInt("SMTP_PORT", 587, 1, 65535);
  const secureFlag = read("SMTP_SECURE");
  const secure = secureFlag ? secureFlag === "true" : port === 465;
  const requireTlsFlag = read("SMTP_REQUIRE_TLS");
  return {
    host,
    port,
    secure,
    // In production, never fall back to plaintext on STARTTLS ports unless explicitly allowed.
    requireTLS: !secure && (requireTlsFlag ? requireTlsFlag === "true" : isProduction()),
    user: read("SMTP_USER"),
    pass: read("SMTP_PASS"),
    from: read("SMTP_FROM") ?? "Scriptly.ai <no-reply@scriptly.ai>",
  };
}

export interface OpenAIConfig {
  apiKey?: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  reasoningEffort?: string;
}

// gpt-4o-mini shuts down on 2027-01-14; OpenAI lists gpt-6-luna as its replacement.
export const DEFAULT_OPENAI_MODEL = "gpt-6-luna";

export function getOpenAIConfig(): OpenAIConfig {
  // Copywriting doesn't benefit from hidden reasoning, which also eats the output budget,
  // so "none" is the default. Models that reject the parameter are retried without it;
  // OPENAI_REASONING_EFFORT=auto omits it entirely.
  const effort = read("OPENAI_REASONING_EFFORT") ?? "none";
  return {
    apiKey: read("OPENAI_API_KEY"),
    model: read("OPENAI_MODEL") ?? DEFAULT_OPENAI_MODEL,
    baseUrl: (read("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, ""),
    timeoutMs: readInt("OPENAI_TIMEOUT_MS", 90_000, 5_000, 300_000),
    reasoningEffort: effort === "auto" ? undefined : effort,
  };
}

export function getSignupBonusCredits(): number {
  return readInt("SIGNUP_BONUS_CREDITS", 25, 0, 100_000);
}

export interface TurnstileConfig {
  siteKey: string;
  secretKey: string;
}

/**
 * Cloudflare Turnstile bot check on signup, login and password reset.
 * Enabled only when both keys are set; read at request time, so no rebuild is
 * needed to turn it on.
 */
export function getTurnstileConfig(): TurnstileConfig | null {
  const siteKey = read("TURNSTILE_SITE_KEY");
  const secretKey = read("TURNSTILE_SECRET_KEY");
  return siteKey && secretKey ? { siteKey, secretKey } : null;
}

/** Exactly one of the two keys is set: refuse to run half-protected. */
export function isTurnstileMisconfigured(): boolean {
  return Boolean(read("TURNSTILE_SITE_KEY")) !== Boolean(read("TURNSTILE_SECRET_KEY"));
}

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

export function getRazorpayConfig(): RazorpayConfig | null {
  const keyId = read("RAZORPAY_KEY_ID");
  const keySecret = read("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret, webhookSecret: read("RAZORPAY_WEBHOOK_SECRET") };
}
