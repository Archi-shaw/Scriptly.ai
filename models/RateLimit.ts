import mongoose, { Schema, type Model } from "mongoose";

/** Fixed-window counters shared by every server instance; expired windows are removed by TTL. */
const rateLimitSchema = new Schema(
  {
    _id: { type: String, required: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface RateLimitDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

const RateLimit =
  (mongoose.models.RateLimit as Model<RateLimitDoc>) || mongoose.model<RateLimitDoc>("RateLimit", rateLimitSchema);

export default RateLimit;
