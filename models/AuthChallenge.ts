import mongoose, { Schema, type InferSchemaType, type Model, type Types } from "mongoose";

export const CHALLENGE_PURPOSES = ["signup", "login", "password_reset", "email_change"] as const;
export type ChallengePurpose = (typeof CHALLENGE_PURPOSES)[number];

/**
 * A one-time email verification code. The `_id` is the SHA-256 of an opaque
 * token held only by the browser that started the flow; the code itself is
 * stored as an HMAC so a database leak does not reveal usable codes.
 */
const authChallengeSchema = new Schema(
  {
    _id: { type: String, required: true },
    purpose: { type: String, enum: CHALLENGE_PURPOSES, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0, min: 0 },
    sendCount: { type: Number, default: 1, min: 1 },
    lastSentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    // Pending signup data / requested email change. Never contains plain-text secrets.
    payload: {
      name: { type: String, maxlength: 80 },
      passwordHash: { type: String },
      newEmail: { type: String, lowercase: true, trim: true },
    },
    ip: { type: String, maxlength: 64 },
    userAgent: { type: String, maxlength: 512 },
    // Documents are removed by a TTL index a day after the code expires.
    purgeAt: { type: Date, required: true },
  },
  { timestamps: true },
);

authChallengeSchema.index({ email: 1, purpose: 1 });
authChallengeSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export type AuthChallengeDoc = InferSchemaType<typeof authChallengeSchema> & { _id: string; userId?: Types.ObjectId };

const AuthChallenge =
  (mongoose.models.AuthChallenge as Model<AuthChallengeDoc>) ||
  mongoose.model<AuthChallengeDoc>("AuthChallenge", authChallengeSchema);

export default AuthChallenge;
