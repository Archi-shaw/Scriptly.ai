import mongoose, { Schema, type InferSchemaType, type Model, type Types } from "mongoose";

export const ORDER_STATUSES = ["created", "paid", "failed", "cancelled", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const REFUND_STATUSES = ["created", "processed", "failed"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/** A provider refund against this order's payment, as reported by webhooks. */
const refundSchema = new Schema(
  {
    refundId: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: REFUND_STATUSES, required: true },
    // Where this refund starts within the order's refunded total (minor units),
    // so credits are split exactly across several partial refunds.
    rangeStart: { type: Number, min: 0 },
    // pending → credits not yet taken back; applied → done (creditsReversed may be
    // less than creditsTarget if the credits were already spent); restored → the
    // refund failed and reversed credits were given back; none → nothing to do.
    reversal: { type: String, enum: ["pending", "applied", "restored", "none"], required: true },
    creditsTarget: { type: Number, default: 0, min: 0 },
    creditsReversed: { type: Number, default: 0, min: 0 },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    packageId: { type: Schema.Types.ObjectId, ref: "CreditPackage", required: true },
    // Snapshot of what was purchased, so later package edits never change past orders.
    packageSnapshot: {
      slug: { type: String, required: true },
      name: { type: String, required: true },
      credits: { type: Number, required: true, min: 1 },
      bonusCredits: { type: Number, default: 0, min: 0 },
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true },
    receipt: { type: String, required: true, unique: true },
    provider: { type: String, enum: ["razorpay"], required: true },
    providerOrderId: { type: String, unique: true, sparse: true },
    providerPaymentId: { type: String },
    status: { type: String, enum: ORDER_STATUSES, default: "created" },
    fulfillmentStatus: { type: String, enum: ["pending", "fulfilled"], default: "pending" },
    failureReason: { type: String, maxlength: 300 },
    paidAt: { type: Date },
    fulfilledAt: { type: Date },
    // Sum of refunds that haven't failed (minor units). Fully refunded orders get status "refunded".
    refundedAmount: { type: Number, default: 0, min: 0 },
    refunds: { type: [refundSchema], default: [] },
  },
  { timestamps: true },
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ providerPaymentId: 1 }, { sparse: true });

export type OrderDoc = InferSchemaType<typeof orderSchema> & { _id: Types.ObjectId };

const Order = (mongoose.models.Order as Model<OrderDoc>) || mongoose.model<OrderDoc>("Order", orderSchema);

export default Order;
