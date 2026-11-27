import "server-only";
import { createHash } from "node:crypto";
import dbConnect, { isDuplicateKeyError } from "@/lib/db";
import { ApiError } from "@/lib/api";
import RateLimit from "@/models/RateLimit";

export interface RateLimitRule {
  key: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Stable, non-reversible key part for personal identifiers such as email
 * addresses, so rate-limit documents don't store them in plain text.
 */
export function hashedKey(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}

function windowInfo(windowSeconds: number, now = Date.now()) {
  const windowMs = windowSeconds * 1000;
  const start = Math.floor(now / windowMs) * windowMs;
  return { start, end: start + windowMs };
}

function result(rule: RateLimitRule, count: number, end: number): RateLimitResult {
  return {
    allowed: count <= rule.limit,
    count,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((end - Date.now()) / 1000)),
  };
}

/** Counts one hit against a fixed window (atomic across instances). */
export async function hitRateLimit(rule: RateLimitRule): Promise<RateLimitResult> {
  await dbConnect();
  const { start, end } = windowInfo(rule.windowSeconds);
  const id = `${rule.key}:${rule.windowSeconds}:${start}`;
  const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(end) } };
  let doc;
  try {
    doc = await RateLimit.findOneAndUpdate({ _id: id }, update, { upsert: true, new: true }).lean();
  } catch (error) {
    // Two concurrent upserts for a new window: retry once against the winner.
    if (!isDuplicateKeyError(error)) throw error;
    doc = await RateLimit.findOneAndUpdate({ _id: id }, update, { upsert: true, new: true }).lean();
  }
  return result(rule, doc?.count ?? 1, end);
}

/** Reads the current window without counting a hit. */
export async function peekRateLimit(rule: RateLimitRule): Promise<RateLimitResult> {
  await dbConnect();
  const { start, end } = windowInfo(rule.windowSeconds);
  const doc = await RateLimit.findById(`${rule.key}:${rule.windowSeconds}:${start}`).lean();
  const count = doc?.count ?? 0;
  return { ...result(rule, count, end), allowed: count < rule.limit };
}

export function rateLimitError(retryAfterSeconds: number, message?: string): ApiError {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return new ApiError(
    429,
    "RATE_LIMITED",
    message ??
      (retryAfterSeconds < 90
        ? `Too many requests. Please wait ${retryAfterSeconds} seconds and try again.`
        : `Too many requests. Please try again in about ${minutes} minutes.`),
    { retryAfter: retryAfterSeconds },
  );
}

/** Counts a hit for every rule and throws 429 if any is exceeded. */
export async function enforceRateLimits(rules: RateLimitRule[], message?: string): Promise<void> {
  const results = await Promise.all(rules.map(hitRateLimit));
  const blocked = results.filter((r) => !r.allowed);
  if (blocked.length > 0) {
    throw rateLimitError(Math.max(...blocked.map((r) => r.retryAfterSeconds)), message);
  }
}
