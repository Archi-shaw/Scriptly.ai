import { expect, it } from "vitest";
import { changeCredits, chargeCredits, grantCredits, refundCredits } from "@/lib/credits";
import User from "@/models/User";
import CreditTransaction from "@/models/CreditTransaction";
import { describeWithDb, useTestDatabase } from "../helpers/db";

async function makeUser(credits = 0) {
  const user = await User.create({ name: "Test", email: `u${Date.now()}${Math.random()}@example.com`, emailVerified: true });
  if (credits > 0) await grantCredits(user._id, credits, { type: "bonus", description: "seed", idempotencyKey: `seed:${user._id}` });
  return user;
}

describeWithDb("credit ledger", () => {
  useTestDatabase();

  it("grants, charges and refunds with an append-only ledger", async () => {
    const user = await makeUser(10);
    const charge = await chargeCredits(user._id, 3, { description: "Generated", idempotencyKey: "gen:1" });
    expect(charge.balance).toBe(7);
    const refund = await refundCredits(user._id, 3, { description: "Refund", idempotencyKey: "refund:1" });
    expect(refund.balance).toBe(10);

    const fresh = await User.findById(user._id).lean();
    expect(fresh).toMatchObject({ availableCredits: 10, totalCreditsEarned: 10, totalCreditsUsed: 0 });
    const ledger = await CreditTransaction.find({ userId: user._id }).sort({ createdAt: 1 }).lean();
    expect(ledger.map((t) => [t.type, t.amount, t.balanceBefore, t.balanceAfter])).toEqual([
      ["bonus", 10, 0, 10],
      ["usage", -3, 10, 7],
      ["refund", 3, 7, 10],
    ]);
  });

  it("refuses to overdraw and records nothing on failure", async () => {
    const user = await makeUser(2);
    await expect(chargeCredits(user._id, 3, { description: "x", idempotencyKey: "gen:big" })).rejects.toMatchObject({
      status: 402,
      code: "INSUFFICIENT_CREDITS",
    });
    expect((await User.findById(user._id).lean())?.availableCredits).toBe(2);
    expect(await CreditTransaction.countDocuments({ idempotencyKey: "gen:big" })).toBe(0);
  });

  it("applies a retried operation (same idempotency key) only once", async () => {
    const user = await makeUser(10);
    const first = await chargeCredits(user._id, 2, { description: "x", idempotencyKey: "gen:retry" });
    const second = await chargeCredits(user._id, 2, { description: "x", idempotencyKey: "gen:retry" });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect((await User.findById(user._id).lean())?.availableCredits).toBe(8);
  });

  it("never goes negative under concurrent charges", async () => {
    const user = await makeUser(10);
    const results = await Promise.allSettled(
      Array.from({ length: 25 }, (_, i) => chargeCredits(user._id, 1, { description: "x", idempotencyKey: `gen:c${i}` })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason.code === "INSUFFICIENT_CREDITS")).toBe(true);
    const fresh = await User.findById(user._id).lean();
    expect(fresh?.availableCredits).toBe(0);
    expect(fresh?.totalCreditsUsed).toBe(10);
    expect(await CreditTransaction.countDocuments({ userId: user._id, type: "usage" })).toBe(10);
  });

  it("applies concurrent duplicates of one operation exactly once", async () => {
    const user = await makeUser(10);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => chargeCredits(user._id, 1, { description: "x", idempotencyKey: "gen:same" })),
    );
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect((await User.findById(user._id).lean())?.availableCredits).toBe(9);
    expect(await CreditTransaction.countDocuments({ idempotencyKey: "gen:same" })).toBe(1);
  });

  it("rejects non-integer or zero changes", async () => {
    const user = await makeUser(5);
    await expect(changeCredits({ userId: user._id, amount: 0.5, type: "adjustment", description: "x", idempotencyKey: "k1" })).rejects.toThrow();
    await expect(changeCredits({ userId: user._id, amount: 0, type: "adjustment", description: "x", idempotencyKey: "k2" })).rejects.toThrow();
  });
});
