import "server-only";
import type { Types } from "mongoose";
import dbConnect from "@/lib/db";
import { ApiError } from "@/lib/api";
import { grantCredits } from "@/lib/credits";
import type { ProviderPayment } from "@/lib/payments/types";
import Order, { type OrderDoc } from "@/models/Order";

const PAID_STATUSES = new Set(["captured"]);

/**
 * Credits a paid order exactly once. Called from the checkout verification
 * endpoint and from the webhook; whichever arrives first wins, the other is a
 * no-op thanks to the ledger idempotency key `order:<id>`.
 */
export async function fulfillOrder(
  orderId: Types.ObjectId | string,
  payment: ProviderPayment,
): Promise<{ order: OrderDoc; credited: boolean }> {
  await dbConnect();
  const order = await Order.findById(orderId).lean();
  if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");

  if (payment.orderId !== order.providerOrderId) {
    throw new ApiError(400, "PAYMENT_MISMATCH", "This payment does not belong to the order.");
  }
  if (payment.amount !== order.amount || payment.currency.toUpperCase() !== order.currency.toUpperCase()) {
    console.error("[orders] amount/currency mismatch", { order: order._id.toString(), payment });
    await Order.updateOne({ _id: order._id }, { $set: { failureReason: "Payment amount mismatch" } });
    throw new ApiError(400, "PAYMENT_MISMATCH", "The payment amount does not match the order.");
  }
  if (!PAID_STATUSES.has(payment.status)) {
    throw new ApiError(409, "PAYMENT_NOT_CAPTURED", "The payment has not been completed yet. Credits will be added once it is.");
  }
  if (order.status === "refunded") {
    // e.g. a delayed webhook retry after the payment was refunded: never re-credit.
    throw new ApiError(409, "ORDER_REFUNDED", "This order has been refunded.");
  }

  const now = new Date();
  await Order.updateOne(
    { _id: order._id, status: { $ne: "refunded" } },
    { $set: { status: "paid", providerPaymentId: payment.id, paidAt: order.paidAt ?? now }, $unset: { failureReason: 1 } },
  );

  const snapshot = order.packageSnapshot;
  if (!snapshot) throw new ApiError(500, "ORDER_INVALID", "Order is missing its package details.");
  const credits = snapshot.credits + (snapshot.bonusCredits ?? 0);
  const grant = await grantCredits(order.userId, credits, {
    type: "purchase",
    description: `Purchased ${snapshot.name} package`,
    idempotencyKey: `order:${order._id.toString()}`,
    orderId: order._id,
  });

  const updated = await Order.findOneAndUpdate(
    { _id: order._id },
    { $set: { fulfillmentStatus: "fulfilled", fulfilledAt: order.fulfilledAt ?? now } },
    { new: true },
  ).lean();

  return { order: updated ?? order, credited: !grant.duplicate };
}

export function serializeOrder(order: OrderDoc) {
  return {
    id: order._id.toString(),
    packageName: order.packageSnapshot?.name ?? "Credit package",
    credits: (order.packageSnapshot?.credits ?? 0) + (order.packageSnapshot?.bonusCredits ?? 0),
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    fulfillmentStatus: order.fulfillmentStatus,
    refundedAmount: order.refundedAmount ?? 0,
    provider: order.provider,
    createdAt: new Date(order.createdAt).toISOString(),
    paidAt: order.paidAt ? new Date(order.paidAt).toISOString() : null,
  };
}
