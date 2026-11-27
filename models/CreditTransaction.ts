import mongoose, { Schema, type InferSchemaType, type Model, type Types } from "mongoose";

// "refund" gives back credits charged for a failed AI operation; "reversal" takes back
// purchased credits when the payment itself is refunded.
export const CREDIT_TRANSACTION_TYPES = ["bonus", "purchase", "usage", "refund", "reversal", "adjustment"] as const;
export type CreditTransactionType = (typeof CREDIT_TRANSACTION_TYPES)[number];

/** Append-only ledger of every change to a user's credit balance. */
const creditTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: CREDIT_TRANSACTION_TYPES, required: true },
    // Signed: positive for credits added, negative for credits spent.
    amount: {
      type: Number,
      required: true,
      validate: { validator: (v: number) => Number.isInteger(v) && v !== 0, message: "amount must be a non-zero integer" },
    },
    balanceBefore: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["completed", "reversed"], default: "completed" },
    description: { type: String, required: true, maxlength: 300 },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    contentId: { type: Schema.Types.ObjectId, ref: "GeneratedContent" },
    // Guarantees a retried operation is recorded (and applied) only once.
    idempotencyKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

creditTransactionSchema.index({ userId: 1, createdAt: -1 });

export type CreditTransactionDoc = InferSchemaType<typeof creditTransactionSchema> & { _id: Types.ObjectId };

const CreditTransaction =
  (mongoose.models.CreditTransaction as Model<CreditTransactionDoc>) ||
  mongoose.model<CreditTransactionDoc>("CreditTransaction", creditTransactionSchema);

export default CreditTransaction;
