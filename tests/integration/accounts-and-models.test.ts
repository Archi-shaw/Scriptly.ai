import { expect, it } from "vitest";
import mongoose from "mongoose";
import { completeLogin, completeSignup, upsertGoogleUser } from "@/lib/auth/accounts";
import { hitRateLimit, peekRateLimit, enforceRateLimits } from "@/lib/rate-limit";
import { listActivePackages } from "@/lib/packages";
import User from "@/models/User";
import CreditTransaction from "@/models/CreditTransaction";
import CreditPackage from "@/models/CreditPackage";
import DocumentModel from "@/models/Document";
import GeneratedContent from "@/models/GeneratedContent";
import type { AuthChallengeDoc } from "@/models/AuthChallenge";
import { describeWithDb, useTestDatabase } from "../helpers/db";

function challenge(overrides: Partial<AuthChallengeDoc>): AuthChallengeDoc {
  return {
    _id: "c",
    purpose: "signup",
    email: "new@example.com",
    codeHash: "x",
    attempts: 1,
    sendCount: 1,
    lastSentAt: new Date(),
    expiresAt: new Date(),
    consumedAt: new Date(),
    purgeAt: new Date(),
    payload: {},
    ...overrides,
  } as AuthChallengeDoc;
}

describeWithDb("accounts", () => {
  useTestDatabase();

  it("creates a verified account with signup bonus credits only after verification", async () => {
    const session = await completeSignup(challenge({ payload: { name: "New User", passwordHash: "$2b$12$hash" } }));
    const user = await User.findById(session.id).select("+passwordHash").lean();
    expect(user).toMatchObject({ email: "new@example.com", emailVerified: true, availableCredits: 25, totalCreditsEarned: 25 });
    expect(user?.passwordHash).toBe("$2b$12$hash");
    expect(await CreditTransaction.countDocuments({ userId: user!._id, type: "bonus", amount: 25 })).toBe(1);
  });

  it("prevents duplicate accounts for one email", async () => {
    await completeSignup(challenge({ payload: { name: "One", passwordHash: "h" } }));
    await expect(completeSignup(challenge({ payload: { name: "Two", passwordHash: "h" } }))).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    expect(await User.countDocuments({ email: "new@example.com" })).toBe(1);
  });

  it("refuses to sign in suspended accounts", async () => {
    const user = await User.create({ name: "S", email: "s@example.com", status: "suspended" });
    await expect(completeLogin(challenge({ purpose: "login", userId: user._id }))).rejects.toMatchObject({ code: "ACCOUNT_UNAVAILABLE" });
  });

  it("links Google sign-in to an existing account with the same email", async () => {
    const existing = await User.create({ name: "Ex", email: "ex@example.com", passwordHash: "h" });
    const session = await upsertGoogleUser({ sub: "google-123", email: "Ex@Example.com", name: "Ex G" });
    expect(session.id).toBe(existing._id.toString());
    expect((await User.findById(existing._id).lean())?.googleId).toBe("google-123");
    const created = await upsertGoogleUser({ sub: "google-456", email: "fresh@example.com", name: "Fresh" });
    expect((await User.findById(created.id).lean())?.availableCredits).toBe(25);
  });
});

describeWithDb("models", () => {
  useTestDatabase();

  it("validates and normalises users", async () => {
    await expect(User.create({ email: "x@example.com" })).rejects.toThrow(/name/);
    await expect(User.create({ name: "X", email: "not-an-email" })).rejects.toThrow();
    const u = await User.create({ name: "X", email: "  MiXeD@Example.com " });
    expect(u.email).toBe("mixed@example.com");
    await expect(User.create({ name: "Y", email: "mixed@example.com" })).rejects.toMatchObject({ code: 11000 });
  });

  it("validates ledger, packages, documents and generations", async () => {
    const userId = new mongoose.Types.ObjectId();
    await expect(CreditTransaction.create({ userId, type: "usage", amount: 0, balanceBefore: 1, balanceAfter: 1, description: "x" })).rejects.toThrow();
    await expect(CreditTransaction.create({ userId, type: "usage", amount: -1, balanceBefore: 0, balanceAfter: -1, description: "x" })).rejects.toThrow();
    await expect(CreditPackage.create({ slug: "Bad Slug!", name: "x", credits: 1, priceMinor: 1 })).rejects.toThrow();
    await expect(CreditPackage.create({ slug: "ok", name: "x", credits: 1.5, priceMinor: 1 })).rejects.toThrow();
    await expect(DocumentModel.create({ userId, title: "" })).rejects.toThrow();
    const base = { userId, kind: "generate", templateId: "t", templateName: "T", category: "blog", language: "en-US", requestId: "req-12345678" };
    await GeneratedContent.create(base);
    await expect(GeneratedContent.create(base)).rejects.toMatchObject({ code: 11000 });
  });

  it("seeds default credit packages once and lists them in order", async () => {
    const packages = await listActivePackages();
    expect(packages.map((p) => p.slug)).toEqual(["starter", "pro", "business"]);
    await listActivePackages();
    expect(await CreditPackage.countDocuments()).toBe(3);
    expect(packages[1]).toMatchObject({ isPopular: true, totalCredits: 550 });
  });
});

describeWithDb("rate limiting", () => {
  useTestDatabase();

  it("counts hits in a fixed window and blocks past the limit", async () => {
    const rule = { key: "test:rl", limit: 3, windowSeconds: 60 };
    expect((await peekRateLimit(rule)).count).toBe(0);
    for (let i = 0; i < 3; i++) expect((await hitRateLimit(rule)).allowed).toBe(true);
    expect((await hitRateLimit(rule)).allowed).toBe(false);
    await expect(enforceRateLimits([rule])).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
    // Concurrent first hits on a fresh window must all be counted.
    const fresh = { key: "test:concurrent", limit: 100, windowSeconds: 60 };
    await Promise.all(Array.from({ length: 20 }, () => hitRateLimit(fresh)));
    expect((await peekRateLimit(fresh)).count).toBe(20);
  });
});
