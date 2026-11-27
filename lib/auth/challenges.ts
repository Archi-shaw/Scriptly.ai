import "server-only";
import { after } from "next/server";
import type { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { ApiError } from "@/lib/api";
import { authConfig } from "@/lib/config";
import { generateOtp, generateToken, hashOtp, sha256, verifyOtp } from "@/lib/auth/otp";
import { sendEmail, EmailNotConfiguredError } from "@/lib/email/mailer";
import { otpEmail } from "@/lib/email/templates";
import { hashedKey, hitRateLimit, peekRateLimit, rateLimitError, type RateLimitRule } from "@/lib/rate-limit";
import AuthChallenge, { type AuthChallengeDoc, type ChallengePurpose } from "@/models/AuthChallenge";

export interface ChallengeInfo {
  challengeToken: string;
  email: string;
  expiresAt: string;
  resendAvailableAt: string;
}

const PURGE_AFTER_MS = 24 * 60 * 60 * 1000;

function deliveryError(error: unknown): ApiError {
  if (error instanceof EmailNotConfiguredError) {
    return new ApiError(503, "EMAIL_NOT_CONFIGURED", "Email delivery is not configured on this server. Please contact support.");
  }
  return new ApiError(503, "EMAIL_DELIVERY_FAILED", "We couldn't send the verification email. Please try again in a moment.");
}

export function challengeNotFound(): ApiError {
  return new ApiError(400, "CHALLENGE_NOT_FOUND", "This verification session is no longer valid. Please start again.");
}

function tooManyAttempts(): ApiError {
  return new ApiError(429, "TOO_MANY_ATTEMPTS", "Too many incorrect attempts. Request a new code to try again.");
}

/**
 * Failed guesses are also capped per email across all challenges. The cap is
 * kept per purpose so that anyone who can start a password reset for an
 * address can't use wrong guesses to lock its owner out of signing in.
 */
function failureRules(purpose: ChallengePurpose, email: string): RateLimitRule[] {
  const id = `${purpose}:${hashedKey(email)}`;
  return [
    { key: `otp-fail:h:${id}`, limit: 10, windowSeconds: 3600 },
    { key: `otp-fail:d:${id}`, limit: 20, windowSeconds: 86_400 },
  ];
}

/**
 * Per-recipient caps on verification emails (first sends and resends), so the
 * forms can't be used to flood an inbox or burn the sending quota, whatever
 * IP addresses an attacker rotates through. Counted per purpose: sign-in codes
 * need the account password, so floods of reset or signup requests can't use
 * up the owner's sign-in allowance.
 */
export const EMAIL_QUOTAS: Record<ChallengePurpose, { hourly: number; daily: number }> = {
  signup: { hourly: 6, daily: 12 },
  login: { hourly: 10, daily: 30 },
  password_reset: { hourly: 6, daily: 12 },
  email_change: { hourly: 6, daily: 12 },
};

function emailQuotaRules(purpose: ChallengePurpose, email: string): RateLimitRule[] {
  const id = `${purpose}:${hashedKey(email)}`;
  const quota = EMAIL_QUOTAS[purpose];
  return [
    { key: `otp-email:h:${id}`, limit: quota.hourly, windowSeconds: 3600 },
    { key: `otp-email:d:${id}`, limit: quota.daily, windowSeconds: 86_400 },
  ];
}

function emailQuotaError(retryAfterSeconds: number): ApiError {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const wait = minutes < 90 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : `${Math.ceil(minutes / 60)} hours`;
  return rateLimitError(retryAfterSeconds, `Too many codes have been sent to this email address. Please try again in about ${wait}.`);
}

/** Counts one email against the recipient's quota; throws 429 if it's used up. */
async function consumeEmailQuota(purpose: ChallengePurpose, email: string): Promise<void> {
  const results = await Promise.all(emailQuotaRules(purpose, email).map(hitRateLimit));
  const blocked = results.filter((r) => !r.allowed);
  if (blocked.length > 0) throw emailQuotaError(Math.max(...blocked.map((r) => r.retryAfterSeconds)));
}

/** Throws 429 if the recipient's quota is used up, without counting anything. */
async function assertEmailQuotaAvailable(purpose: ChallengePurpose, email: string): Promise<void> {
  const results = await Promise.all(emailQuotaRules(purpose, email).map(peekRateLimit));
  const blocked = results.filter((r) => !r.allowed);
  if (blocked.length > 0) throw emailQuotaError(Math.max(...blocked.map((r) => r.retryAfterSeconds)));
}

export async function createChallenge(input: {
  purpose: ChallengePurpose;
  email: string;
  name?: string;
  userId?: Types.ObjectId | string;
  payload?: { name?: string; passwordHash?: string; newEmail?: string };
  ip?: string;
  userAgent?: string;
  /**
   * Decoy mode (password reset for an unknown email): the challenge behaves
   * exactly like a real one but no email is sent, so responses don't reveal
   * whether an account exists.
   */
  skipEmail?: boolean;
  /** Send after the response is returned (constant response time). */
  sendInBackground?: boolean;
}): Promise<ChallengeInfo> {
  await dbConnect();
  // Counted for decoys too, so a capped address looks the same whether or not
  // it has an account. Checked before older codes are invalidated below.
  await consumeEmailQuota(input.purpose, input.email);

  const token = generateToken();
  const id = sha256(token);
  const code = generateOtp();
  const now = Date.now();
  const ttlMinutes = authConfig.otpTtlMinutes();
  const expiresAt = new Date(now + ttlMinutes * 60_000);

  // Only the newest code for a given email/user and purpose remains valid.
  await AuthChallenge.deleteMany({
    purpose: input.purpose,
    consumedAt: null,
    $or: input.userId ? [{ email: input.email }, { userId: input.userId }] : [{ email: input.email }],
  });

  await AuthChallenge.create({
    _id: id,
    purpose: input.purpose,
    email: input.email,
    userId: input.userId,
    codeHash: hashOtp(code, id),
    lastSentAt: new Date(now),
    expiresAt,
    payload: { name: input.name ?? input.payload?.name, ...input.payload },
    ip: input.ip,
    userAgent: input.userAgent,
    purgeAt: new Date(expiresAt.getTime() + PURGE_AFTER_MS),
  });

  const message = otpEmail(input.purpose, code, { to: input.email, name: input.name, ttlMinutes });
  if (input.skipEmail) {
    // Nothing to send.
  } else if (input.sendInBackground) {
    after(async () => {
      try {
        await sendEmail(message);
      } catch (error) {
        console.error("[auth] background email delivery failed", error instanceof Error ? error.message : error);
      }
    });
  } else {
    try {
      await sendEmail(message);
    } catch (error) {
      await AuthChallenge.deleteOne({ _id: id });
      throw deliveryError(error);
    }
  }

  return {
    challengeToken: token,
    email: input.email,
    expiresAt: expiresAt.toISOString(),
    resendAvailableAt: new Date(now + authConfig.otpResendCooldownSeconds() * 1000).toISOString(),
  };
}

/** Issues a fresh code for an open challenge, honouring the cooldown and send limit. */
export async function resendChallenge(token: string): Promise<ChallengeInfo> {
  await dbConnect();
  const id = sha256(token);
  const now = Date.now();
  const cooldownMs = authConfig.otpResendCooldownSeconds() * 1000;
  const maxSends = authConfig.otpMaxSends();
  const ttlMinutes = authConfig.otpTtlMinutes();
  const code = generateOtp();
  const expiresAt = new Date(now + ttlMinutes * 60_000);

  const current = await AuthChallenge.findById(id).select("purpose email consumedAt").lean();
  if (!current || current.consumedAt) throw challengeNotFound();
  // Peek first: a capped recipient must not lose the code they already have.
  await assertEmailQuotaAvailable(current.purpose, current.email);

  const updated = await AuthChallenge.findOneAndUpdate(
    { _id: id, consumedAt: null, lastSentAt: { $lte: new Date(now - cooldownMs) }, sendCount: { $lt: maxSends } },
    {
      $set: {
        codeHash: hashOtp(code, id),
        lastSentAt: new Date(now),
        expiresAt,
        attempts: 0,
        purgeAt: new Date(expiresAt.getTime() + PURGE_AFTER_MS),
      },
      $inc: { sendCount: 1 },
    },
    { new: true },
  ).lean();

  if (!updated) {
    const existing = await AuthChallenge.findById(id).lean();
    if (!existing || existing.consumedAt) throw challengeNotFound();
    if (existing.sendCount >= maxSends) {
      throw new ApiError(429, "RESEND_LIMIT", "You've requested too many codes for this session. Please start again.");
    }
    const retryAfter = Math.max(1, Math.ceil((new Date(existing.lastSentAt).getTime() + cooldownMs - now) / 1000));
    throw new ApiError(429, "RESEND_COOLDOWN", `Please wait ${retryAfter} seconds before requesting a new code.`, {
      retryAfter,
    });
  }
  await Promise.all(emailQuotaRules(updated.purpose, updated.email).map(hitRateLimit));

  const message = otpEmail(updated.purpose, code, { to: updated.email, name: updated.payload?.name ?? undefined, ttlMinutes });
  if (updated.purpose === "password_reset") {
    // Reset flows never reveal whether the account exists: decoys send nothing
    // and real ones send after responding.
    if (updated.userId) {
      after(async () => {
        try {
          await sendEmail(message);
        } catch (error) {
          console.error("[auth] background email delivery failed", error instanceof Error ? error.message : error);
        }
      });
    }
  } else {
    try {
      await sendEmail(message);
    } catch (error) {
      // Delivery failed: let the user retry straight away.
      await AuthChallenge.updateOne({ _id: id }, { $set: { lastSentAt: new Date(now - cooldownMs) } });
      throw deliveryError(error);
    }
  }

  return {
    challengeToken: token,
    email: updated.email,
    expiresAt: expiresAt.toISOString(),
    resendAvailableAt: new Date(now + cooldownMs).toISOString(),
  };
}

/**
 * Verifies a code and consumes the challenge exactly once. Enforces expiry,
 * per-challenge attempt limits and a per-email cap on failed guesses.
 */
export async function verifyChallenge(
  token: string,
  code: string,
  purposes: readonly ChallengePurpose[],
): Promise<AuthChallengeDoc> {
  await dbConnect();
  const id = sha256(token);
  const now = new Date();
  const maxAttempts = authConfig.otpMaxAttempts();

  const existing = await AuthChallenge.findById(id).lean();
  if (!existing || !purposes.includes(existing.purpose)) throw challengeNotFound();
  if (existing.consumedAt) throw new ApiError(400, "CODE_USED", "This code has already been used. Please request a new one.");
  if (new Date(existing.expiresAt) <= now) throw new ApiError(400, "CODE_EXPIRED", "This code has expired. Request a new one.");
  if (existing.attempts >= maxAttempts) throw tooManyAttempts();

  const rules = failureRules(existing.purpose, existing.email);
  const blocked = (await Promise.all(rules.map(peekRateLimit))).find((r) => !r.allowed);
  if (blocked) {
    throw rateLimitError(blocked.retryAfterSeconds, "Too many incorrect codes for this email. Please wait before trying again.");
  }

  const attempt = await AuthChallenge.findOneAndUpdate(
    { _id: id, consumedAt: null, expiresAt: { $gt: now }, attempts: { $lt: maxAttempts } },
    { $inc: { attempts: 1 } },
    { new: true },
  ).lean();
  if (!attempt) {
    throw new ApiError(400, "CODE_UNAVAILABLE", "This code is no longer valid. Please request a new one.");
  }

  if (!verifyOtp(code, id, attempt.codeHash)) {
    await Promise.all(rules.map(hitRateLimit));
    const remaining = Math.max(0, maxAttempts - attempt.attempts);
    if (remaining === 0) throw tooManyAttempts();
    throw new ApiError(400, "CODE_INVALID", `That code isn't right. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`, {
      attemptsRemaining: remaining,
    });
  }

  const consumed = await AuthChallenge.findOneAndUpdate(
    { _id: id, consumedAt: null },
    { $set: { consumedAt: now } },
    { new: true },
  ).lean();
  if (!consumed) throw new ApiError(400, "CODE_USED", "This code has already been used. Please request a new one.");
  return consumed;
}
