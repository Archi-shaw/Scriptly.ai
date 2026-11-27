import { expect, it } from "vitest";
import { buildGenerationPrompt } from "@/lib/ai/prompts";
import { AIError, type AIProvider } from "@/lib/ai/types";
import { chargeCredits, grantCredits } from "@/lib/credits";
import { recoverStaleOperations, runAIOperation, type AIOperation } from "@/lib/generation";
import { fulfillOrder } from "@/lib/orders";
import { creditsForRefund, handleRefundEvent } from "@/lib/refunds";
import { getTemplate } from "@/lib/templates/registry";
import User from "@/models/User";
import CreditTransaction from "@/models/CreditTransaction";
import GeneratedContent from "@/models/GeneratedContent";
import Order from "@/models/Order";
import { describeWithDb, useTestDatabase } from "../helpers/db";

const template = getTemplate("blog-post")!;
const settings = { language: "en-US", tone: "professional", style: "auto", length: "medium" as const, framework: "none" as const, creativity: "balanced" as const };

function provider(behaviour: "ok" | "fail"): AIProvider & { calls: number } {
  const p = {
    name: "fake",
    model: "fake-1",
    calls: 0,
    async generate() {
      p.calls += 1;
      if (behaviour === "fail") throw new AIError("AI_PROVIDER_ERROR", "The AI service is temporarily unavailable.", 502);
      return { text: "# Hello\n\nGenerated text here.", model: "fake-1", truncated: false, usage: { inputTokens: 5, outputTokens: 9 }, durationMs: 3 };
    },
  };
  return p;
}

async function userWith(credits: number) {
  const user = await User.create({ name: "G", email: `g${Math.random()}@example.com`, emailVerified: true });
  if (credits) await grantCredits(user._id, credits, { type: "bonus", description: "seed", idempotencyKey: `seed:${user._id}` });
  return user;
}

function op(userId: AIOperation["userId"], requestId: string): AIOperation {
  return {
    userId,
    requestId,
    kind: "generate",
    template: { id: template.id, name: template.name, category: template.category },
    inputs: { topic: "Testing" },
    settings,
    cost: 3,
    prompt: buildGenerationPrompt(template, { topic: "Testing" }, settings),
    description: "Generated: Blog Post Generator",
  };
}

const balance = async (id: unknown) => (await User.findById(id).lean())?.availableCredits;

describeWithDb("AI operations with server-side credit accounting", () => {
  useTestDatabase();

  it("charges on success and stores the result", async () => {
    const user = await userWith(10);
    const result = await runAIOperation(op(user._id, "req-success-1"), provider("ok"));
    expect(result.generation).toMatchObject({ status: "completed", creditsUsed: 3, output: "# Hello\n\nGenerated text here.", wordCount: 4 });
    expect(await balance(user._id)).toBe(7);
  });

  it("refunds automatically when the AI call fails", async () => {
    const user = await userWith(10);
    await expect(runAIOperation(op(user._id, "req-fail-1"), provider("fail"))).rejects.toMatchObject({
      status: 502,
      code: "AI_PROVIDER_ERROR",
      message: expect.stringMatching(/refunded/),
    });
    expect(await balance(user._id)).toBe(10);
    const record = await GeneratedContent.findOne({ requestId: "req-fail-1" }).lean();
    expect(record).toMatchObject({ status: "refunded", creditsRefunded: 3, errorCode: "AI_PROVIDER_ERROR" });
    const ledger = await CreditTransaction.find({ contentId: record!._id }).lean();
    expect(ledger.map((t) => t.amount).sort()).toEqual([-3, 3]);
  });

  it("never charges twice for a retried request", async () => {
    const user = await userWith(10);
    const ai = provider("ok");
    await runAIOperation(op(user._id, "req-dup-1"), ai);
    const again = await runAIOperation(op(user._id, "req-dup-1"), ai);
    expect(again.reused).toBe(true);
    expect(ai.calls).toBe(1);
    expect(await balance(user._id)).toBe(7);
  });

  it("rejects with 402 and charges nothing when credits are insufficient", async () => {
    const user = await userWith(2);
    const ai = provider("ok");
    await expect(runAIOperation(op(user._id, "req-poor-1"), ai)).rejects.toMatchObject({ status: 402, code: "INSUFFICIENT_CREDITS" });
    expect(ai.calls).toBe(0);
    expect(await balance(user._id)).toBe(2);
    expect((await GeneratedContent.findOne({ requestId: "req-poor-1" }).lean())?.status).toBe("failed");
  });

  it("fails clearly, without charging, when AI is not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const user = await userWith(10);
    await expect(runAIOperation(op(user._id, "req-noai-1"))).rejects.toMatchObject({ status: 503, code: "AI_NOT_CONFIGURED" });
    expect(await balance(user._id)).toBe(10);
    expect(await GeneratedContent.countDocuments({ userId: user._id })).toBe(0);
  });

  it("refunds operations interrupted mid-flight", async () => {
    const user = await userWith(10);
    const stuck = await GeneratedContent.create({
      userId: user._id,
      kind: "generate",
      templateId: template.id,
      templateName: template.name,
      category: template.category,
      language: "en-US",
      requestId: "req-stuck-1",
      status: "pending",
    });
    // Simulate a crash after the charge but before completion, long enough ago to be stale.
    await chargeCredits(user._id, 3, { description: "x", idempotencyKey: `gen:${stuck._id}`, contentId: stuck._id });
    await GeneratedContent.collection.updateOne({ _id: stuck._id }, { $set: { createdAt: new Date(Date.now() - 60 * 60 * 1000) } });
    expect(await balance(user._id)).toBe(7);

    await recoverStaleOperations(user._id);
    expect(await balance(user._id)).toBe(10);
    expect((await GeneratedContent.findById(stuck._id).lean())?.status).toBe("refunded");
    await recoverStaleOperations(user._id);
    expect(await balance(user._id)).toBe(10);
  });
});

describeWithDb("order fulfilment", () => {
  useTestDatabase();

  async function setup() {
    const user = await userWith(0);
    const order = await Order.create({
      userId: user._id,
      packageId: user._id,
      packageSnapshot: { slug: "pro", name: "Pro", credits: 500, bonusCredits: 50 },
      amount: 79_900,
      currency: "INR",
      receipt: `r${Math.random()}`,
      provider: "razorpay",
      providerOrderId: `order_${Math.random()}`,
    });
    return { user, order };
  }

  it("credits a captured payment exactly once, even if verify and webhook race", async () => {
    const { user, order } = await setup();
    const payment = { id: "pay_1", orderId: order.providerOrderId!, status: "captured", amount: 79_900, currency: "INR" };
    const results = await Promise.all([fulfillOrder(order._id, payment), fulfillOrder(order._id, payment), fulfillOrder(order._id, payment)]);
    expect(results.filter((r) => r.credited)).toHaveLength(1);
    expect(await balance(user._id)).toBe(550);
    expect(await Order.findById(order._id).lean()).toMatchObject({ status: "paid", fulfillmentStatus: "fulfilled", providerPaymentId: "pay_1" });
  });

  it("never credits mismatched or uncaptured payments", async () => {
    const { user, order } = await setup();
    const base = { id: "pay_2", orderId: order.providerOrderId!, status: "captured", amount: 79_900, currency: "INR" };
    await expect(fulfillOrder(order._id, { ...base, amount: 100 })).rejects.toMatchObject({ code: "PAYMENT_MISMATCH" });
    await expect(fulfillOrder(order._id, { ...base, orderId: "order_other" })).rejects.toMatchObject({ code: "PAYMENT_MISMATCH" });
    await expect(fulfillOrder(order._id, { ...base, status: "authorized" })).rejects.toMatchObject({ code: "PAYMENT_NOT_CAPTURED" });
    expect(await balance(user._id)).toBe(0);
  });
});

describeWithDb("refund reconciliation", () => {
  useTestDatabase();

  const AMOUNT = 79_900;
  const CREDITS = 550; // 500 + 50 bonus

  async function paidOrder(extraCredits = 0) {
    const user = await userWith(extraCredits);
    const order = await Order.create({
      userId: user._id,
      packageId: user._id,
      packageSnapshot: { slug: "pro", name: "Pro", credits: 500, bonusCredits: 50 },
      amount: AMOUNT,
      currency: "INR",
      receipt: `r${Math.random()}`,
      provider: "razorpay",
      providerOrderId: `order_${Math.random()}`,
    });
    const paymentId = `pay_${Math.random().toString(36).slice(2)}`;
    await fulfillOrder(order._id, { id: paymentId, orderId: order.providerOrderId!, status: "captured", amount: AMOUNT, currency: "INR" });
    return { user, order, paymentId };
  }

  const refund = (paymentId: string, id: string, amount: number, currency = "INR") => ({ id, paymentId, amount, currency });
  const reversals = (userId: unknown) => CreditTransaction.find({ userId, type: "reversal" }).lean();

  it("takes back the credits of a fully refunded payment exactly once", async () => {
    const { user, order, paymentId } = await paidOrder();
    expect(await balance(user._id)).toBe(CREDITS);

    const first = await handleRefundEvent("refund.created", refund(paymentId, "rfnd_full", AMOUNT), order.providerOrderId!);
    expect(first).toMatchObject({ result: "applied", creditsReversed: CREDITS, creditsShortfall: 0 });
    // Retries, the later "processed" event and concurrent duplicates change nothing.
    await Promise.all([
      handleRefundEvent("refund.created", refund(paymentId, "rfnd_full", AMOUNT), order.providerOrderId!),
      handleRefundEvent("refund.processed", refund(paymentId, "rfnd_full", AMOUNT), order.providerOrderId!),
      handleRefundEvent("refund.processed", refund(paymentId, "rfnd_full", AMOUNT)),
    ]);

    expect(await balance(user._id)).toBe(0);
    expect(await reversals(user._id)).toHaveLength(1);
    const saved = await Order.findById(order._id).lean();
    expect(saved).toMatchObject({ status: "refunded", refundedAmount: AMOUNT });
    expect(saved!.refunds).toHaveLength(1);
    expect(saved!.refunds![0]).toMatchObject({ refundId: "rfnd_full", status: "processed", reversal: "applied", creditsReversed: CREDITS });
    expect((await User.findById(user._id).lean())!.totalCreditsEarned).toBe(0);
  });

  it("splits credits exactly across partial refunds, even when they arrive together", async () => {
    const { user, order, paymentId } = await paidOrder();
    const parts = [33_300, 13_300, 33_300]; // sums to the full amount
    await Promise.all(parts.map((amount, i) => handleRefundEvent("refund.processed", refund(paymentId, `rfnd_part_${i}`, amount))));

    const saved = await Order.findById(order._id).lean();
    expect(saved).toMatchObject({ status: "refunded", refundedAmount: AMOUNT });
    const reversed = saved!.refunds!.reduce((sum, r) => sum + r.creditsReversed, 0);
    expect(reversed).toBe(CREDITS);
    expect(await balance(user._id)).toBe(0);
  });

  it("keeps a partially refunded order paid and reverses only its share", async () => {
    const { user, order, paymentId } = await paidOrder();
    await handleRefundEvent("refund.processed", refund(paymentId, "rfnd_half", AMOUNT / 2));
    expect(await balance(user._id)).toBe(CREDITS / 2);
    expect(await Order.findById(order._id).lean()).toMatchObject({ status: "paid", refundedAmount: AMOUNT / 2 });
  });

  it("never takes the balance below zero: spent credits are reported as a shortfall", async () => {
    const { user, paymentId } = await paidOrder();
    await chargeCredits(user._id, 500, { description: "spent", idempotencyKey: "spend-1" });
    const outcome = await handleRefundEvent("refund.processed", refund(paymentId, "rfnd_spent", AMOUNT));
    expect(outcome).toMatchObject({ result: "applied", creditsReversed: 50, creditsShortfall: 500 });
    expect(await balance(user._id)).toBe(0);
  });

  it("restores the credits when a refund fails, and ignores events that arrive after", async () => {
    const { user, order, paymentId } = await paidOrder();
    await handleRefundEvent("refund.created", refund(paymentId, "rfnd_fails", AMOUNT));
    expect(await balance(user._id)).toBe(0);

    expect(await handleRefundEvent("refund.failed", refund(paymentId, "rfnd_fails", AMOUNT))).toMatchObject({
      result: "failed",
      creditsRestored: CREDITS,
    });
    expect(await handleRefundEvent("refund.failed", refund(paymentId, "rfnd_fails", AMOUNT))).toMatchObject({ result: "duplicate" });
    expect(await handleRefundEvent("refund.processed", refund(paymentId, "rfnd_fails", AMOUNT))).toMatchObject({ result: "ignored" });

    expect(await balance(user._id)).toBe(CREDITS);
    expect(await Order.findById(order._id).lean()).toMatchObject({ status: "paid", refundedAmount: 0 });
  });

  it("remembers a refund that failed before it was seen, so late events don't reverse credits", async () => {
    const { user, paymentId } = await paidOrder();
    await handleRefundEvent("refund.failed", refund(paymentId, "rfnd_early_fail", AMOUNT));
    await handleRefundEvent("refund.created", refund(paymentId, "rfnd_early_fail", AMOUNT));
    expect(await balance(user._id)).toBe(CREDITS);
  });

  it("records refunds of payments that were never credited without touching the balance", async () => {
    const user = await userWith(7);
    const order = await Order.create({
      userId: user._id,
      packageId: user._id,
      packageSnapshot: { slug: "pro", name: "Pro", credits: 500, bonusCredits: 50 },
      amount: AMOUNT,
      currency: "INR",
      receipt: `r${Math.random()}`,
      provider: "razorpay",
      providerOrderId: `order_${Math.random()}`,
    });
    // e.g. Razorpay auto-refunding an authorized payment that was never captured
    await handleRefundEvent("refund.processed", refund("pay_uncaptured", "rfnd_auto", AMOUNT), order.providerOrderId!);
    expect(await balance(user._id)).toBe(7);
    expect(await Order.findById(order._id).lean()).toMatchObject({ status: "refunded" });
    // A delayed capture webhook can't credit a refunded order.
    await expect(
      fulfillOrder(order._id, { id: "pay_uncaptured", orderId: order.providerOrderId!, status: "captured", amount: AMOUNT, currency: "INR" }),
    ).rejects.toMatchObject({ code: "ORDER_REFUNDED" });
    expect(await balance(user._id)).toBe(7);
  });

  it("rejects mismatched refunds and ignores unknown payments", async () => {
    const { user, order, paymentId } = await paidOrder();
    await expect(handleRefundEvent("refund.processed", refund(paymentId, "rfnd_usd", AMOUNT, "USD"))).rejects.toMatchObject({
      code: "REFUND_MISMATCH",
    });
    await expect(handleRefundEvent("refund.processed", refund("pay_other", "rfnd_x", AMOUNT), order.providerOrderId!)).rejects.toMatchObject({
      code: "REFUND_MISMATCH",
    });
    expect(await handleRefundEvent("refund.processed", refund("pay_unknown", "rfnd_y", AMOUNT))).toMatchObject({ result: "ignored" });
    await expect(handleRefundEvent("refund.processed", refund(paymentId, "rfnd_zero", 0))).rejects.toMatchObject({ code: "INVALID_REFUND" });
    expect(await balance(user._id)).toBe(CREDITS);
  });

  it("computes shares that add up to the package", () => {
    const order = { amount: 1000, fulfillmentStatus: "fulfilled", packageSnapshot: { slug: "s", name: "S", credits: 7, bonusCredits: 0 } } as const;
    const slices = [[0, 333], [333, 333], [666, 334]].map(([start, amount]) => creditsForRefund(order as never, start, amount));
    expect(slices.reduce((a, b) => a + b, 0)).toBe(7);
    expect(creditsForRefund({ ...order, fulfillmentStatus: "pending" } as never, 0, 1000)).toBe(0);
  });
});
