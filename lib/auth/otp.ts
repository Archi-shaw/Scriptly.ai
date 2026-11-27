import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { getAuthSecret } from "@/lib/config";

/** Cryptographically secure 6-digit code (000000–999999). */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Opaque, URL-safe token identifying a verification flow in the browser. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function otpKey(): Buffer {
  // Domain-separated key derived from the app secret.
  return createHmac("sha256", getAuthSecret()).update("scriptly:otp:v1").digest();
}

/**
 * Codes are stored as an HMAC bound to their challenge, so a leaked database
 * row cannot be brute-forced offline without the server secret.
 */
export function hashOtp(code: string, challengeId: string): string {
  return createHmac("sha256", otpKey()).update(`${challengeId}:${code}`).digest("hex");
}

export function verifyOtp(code: string, challengeId: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(code, challengeId), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
