import "server-only";
import dbConnect from "@/lib/db";
import { ApiError } from "@/lib/api";
import { grantCredits, reverseCredits } from "@/lib/credits";
import CreditTransaction from "@/models/CreditTransaction";
import Order, { type OrderDoc, type RefundStatus } from "@/models/Order";

/**
 * Refund reconciliation. Refunds are issued from the Razorpay Dashboard (or
 * API); Razorpay then reports them via webhooks and this module brings the
 * order and the credit ledger in line:
 *
 * - refund.created / refund.processed → the refund is recorded on the order and
 *   the matching share of the package's credits is taken back (never below a
 *   zero balance — credits already spent are reported as a shortfall).
 * - refund.failed → the refund no longer counts and any credits taken back for
 *   it are restored.
 *
 * Every step is idempotent (refund id on the order + ledger keys), so webhook
 * retries, duplicates and out-of-order delivery are safe.
 */

export interface ProviderRefund {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
}

export type RefundEvent = "refund.created" | "refund.processed" | "refund.failed";

export interface RefundOutcome {
  result: "applied" | "updated" | "duplicate" | "failed" | "ignored";
  creditsReversed?: number;
  creditsShortfall?: number;
  creditsRestored?: number;
}

type RefundEntry = NonNullable<OrderDoc["refunds"]>[number];

const reversalKey = (refundId: string) => `payment-refund:${refundId}`;
const restoreKey = (refundId: string) => `payment-refund-failed:${refundId}`;

function packageCredits(order: OrderDoc): number {
  return (order.packageSnapshot?.credits ?? 0) + (order.packageSnapshot?.bonusCredits ?? 0);
}

/**
 * Credits to take back for one refund. Each refund owns a slice of the order's
 * refunded total ([rangeStart, rangeStart + amount)), so partial refunds add up
 * to exactly the package's credits when the whole payment is refunded.
 * Orders whose credits were never granted have nothing to take back.
 */
export function creditsForRefund(order: Pick<OrderDoc, "amount" | "fulfillmentStatus" | "packageSnapshot">, rangeStart: number, amount: number): number {
  if (order.fulfillmentStatus !== "fulfilled" || order.amount <= 0) return 0;
  const credits = packageCredits(order as OrderDoc);
  const share = (refunded: number) => (refunded >= order.amount ? credits : Math.floor((credits * refunded) / order.amount));
  return Math.max(0, share(rangeStart + amount) - share(rangeStart));
}

async function findOrder(refund: ProviderRefund, providerOrderId?: string): Promise<OrderDoc | null> {
  const order = providerOrderId
    ? await Order.findOne({ providerOrderId }).lean()
    : await Order.findOne({ providerPaymentId: refund.paymentId }).lean();
  if (!order) return null;
  if (order.providerPaymentId && order.providerPaymentId !== refund.paymentId) {
    throw new ApiError(400, "REFUND_MISMATCH", "The refund's payment does not belong to this order.");
  }
  if (refund.currency.toUpperCase() !== order.currency.toUpperCase()) {
    throw new ApiError(400, "REFUND_MISMATCH", "The refund currency does not match the order.");
  }
  return order;
}

/** Marks the order refunded once refunds cover the full amount, and paid again if one failed. */
async function syncOrderStatus(orderId: OrderDoc["_id"]): Promise<void> {
  await Order.updateOne(
    { _id: orderId, status: { $ne: "refunded" }, $expr: { $and: [{ $gt: ["$amount", 0] }, { $gte: ["$refundedAmount", "$amount"] }] } },
    { $set: { status: "refunded" } },
  );
  await Order.updateOne(
    { _id: orderId, status: "refunded", $expr: { $lt: ["$refundedAmount", "$amount"] } },
    { $set: { status: "paid" } },
  );
}

/** Gives back what was reversed for a refund that failed (idempotent). */
async function restoreCredits(order: OrderDoc, refundId: string): Promise<number> {
  const reversal = await CreditTransaction.findOne({ idempotencyKey: reversalKey(refundId) }).lean();
  if (!reversal || reversal.amount >= 0) return 0;
  const restored = -reversal.amount;
  await grantCredits(order.userId, restored, {
    type: "adjustment",
    description: `Credits restored: refund ${refundId} failed`,
    idempotencyKey: restoreKey(refundId),
    orderId: order._id,
  });
  await Order.updateOne(
    { _id: order._id, "refunds.refundId": refundId },
    { $set: { "refunds.$.reversal": "restored", "refunds.$.updatedAt": new Date() } },
  );
  return restored;
}

async function applyReversal(order: OrderDoc, entry: RefundEntry): Promise<RefundOutcome> {
  const target = creditsForRefund(order, entry.rangeStart ?? 0, entry.amount);
  const { reversed } =
    target > 0
      ? await reverseCredits(order.userId, target, {
          description: `Payment refunded: ${order.packageSnapshot?.name ?? "credit"} package`,
          idempotencyKey: reversalKey(entry.refundId),
          orderId: order._id,
        })
      : { reversed: 0 };

  await Order.updateOne(
    { _id: order._id, refunds: { $elemMatch: { refundId: entry.refundId, reversal: "pending" } } },
    {
      $set: {
        "refunds.$.reversal": "applied",
        "refunds.$.creditsTarget": target,
        "refunds.$.creditsReversed": reversed,
        "refunds.$.updatedAt": new Date(),
      },
    },
  );

  const shortfall = target - reversed;
  if (shortfall > 0) {
    console.warn("[refunds] credits already spent; reversed less than the refunded share", {
      order: order._id.toString(),
      refund: entry.refundId,
      target,
      reversed,
    });
  }

  // A refund.failed may have arrived while we were reversing: undo our reversal.
  const latest = await Order.findById(order._id).lean();
  if (latest?.refunds?.some((r) => r.refundId === entry.refundId && r.status === "failed")) {
    await restoreCredits(order, entry.refundId);
  }
  return { result: "applied", creditsReversed: reversed, creditsShortfall: shortfall };
}

async function recordRefund(order: OrderDoc, refund: ProviderRefund, status: Exclude<RefundStatus, "failed">): Promise<RefundOutcome> {
  let entry = order.refunds?.find((r) => r.refundId === refund.id);
  let current = order;

  if (!entry) {
    const now = new Date();
    // One atomic update claims this refund's slice of the refunded total
    // (rangeStart = the total before it) and appends it, so concurrent partial
    // refunds can never overlap.
    const inserted = await Order.findOneAndUpdate(
      { _id: order._id, "refunds.refundId": { $ne: refund.id } },
      [
        {
          $set: {
            refunds: {
              $concatArrays: [
                { $ifNull: ["$refunds", []] },
                [
                  {
                    refundId: { $literal: refund.id },
                    amount: { $literal: refund.amount },
                    status: { $literal: status },
                    rangeStart: { $ifNull: ["$refundedAmount", 0] },
                    reversal: { $literal: "pending" },
                    creditsTarget: { $literal: 0 },
                    creditsReversed: { $literal: 0 },
                    createdAt: { $literal: now },
                    updatedAt: { $literal: now },
                  },
                ],
              ],
            },
            refundedAmount: { $add: [{ $ifNull: ["$refundedAmount", 0] }, refund.amount] },
          },
        },
      ],
      { new: true },
    ).lean();
    current = inserted ?? (await Order.findById(order._id).lean()) ?? order;
    entry = current.refunds?.find((r) => r.refundId === refund.id);
    if (!entry) throw new Error(`Refund ${refund.id} could not be recorded`);
    if (!inserted) return { result: "duplicate" }; // a concurrent delivery recorded it
  } else if (entry.status === "failed") {
    // A late created/processed event for a refund that has already failed.
    return { result: "ignored" };
  } else if (status === "processed" && entry.status === "created") {
    await Order.updateOne(
      { _id: order._id, refunds: { $elemMatch: { refundId: refund.id, status: "created" } } },
      { $set: { "refunds.$.status": "processed", "refunds.$.updatedAt": new Date() } },
    );
  }

  if (entry.reversal !== "pending") {
    return { result: status === "processed" && entry.status === "created" ? "updated" : "duplicate" };
  }
  // New refund, or a retry after a crash before the credits were taken back.
  const outcome = await applyReversal(current, entry);
  await syncOrderStatus(order._id);
  return outcome;
}

async function recordFailure(order: OrderDoc, refund: ProviderRefund): Promise<RefundOutcome> {
  const entry = order.refunds?.find((r) => r.refundId === refund.id);
  const now = new Date();

  if (!entry) {
    // Failed before we saw it created: remember it so late events are ignored.
    await Order.updateOne(
      { _id: order._id, "refunds.refundId": { $ne: refund.id } },
      {
        $push: {
          refunds: { refundId: refund.id, amount: refund.amount, status: "failed", reversal: "none", createdAt: now, updatedAt: now },
        },
      },
    );
    return { result: "failed", creditsRestored: 0 };
  }
  if (entry.status === "failed") return { result: "duplicate" };

  const marked = await Order.findOneAndUpdate(
    { _id: order._id, refunds: { $elemMatch: { refundId: refund.id, status: { $ne: "failed" } } } },
    { $set: { "refunds.$.status": "failed", "refunds.$.updatedAt": now }, $inc: { refundedAmount: -entry.amount } },
    { new: true },
  ).lean();
  if (!marked) return { result: "duplicate" };

  const restored = await restoreCredits(order, refund.id);
  await syncOrderStatus(order._id);
  return { result: "failed", creditsRestored: restored };
}

export async function handleRefundEvent(
  event: RefundEvent,
  refund: ProviderRefund,
  providerOrderId?: string,
): Promise<RefundOutcome> {
  if (!refund.id || !refund.paymentId || !Number.isInteger(refund.amount) || refund.amount <= 0) {
    throw new ApiError(400, "INVALID_REFUND", "The refund event is missing required fields.");
  }
  await dbConnect();
  const order = await findOrder(refund, providerOrderId);
  if (!order) return { result: "ignored" };
  if (event === "refund.failed") return recordFailure(order, refund);
  return recordRefund(order, refund, event === "refund.processed" ? "processed" : "created");
}
