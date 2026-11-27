import mongoose, { Schema, type InferSchemaType, type Model, type Types } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    // bcrypt hash; absent for accounts created through Google only.
    passwordHash: { type: String, select: false },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date },
    googleId: { type: String, unique: true, sparse: true },
    image: { type: String, maxlength: 2048 },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    // Credits are only ever changed through lib/credits.ts (atomic, ledgered).
    availableCredits: { type: Number, default: 0, min: 0 },
    totalCreditsEarned: { type: Number, default: 0, min: 0 },
    totalCreditsUsed: { type: Number, default: 0, min: 0 },

    // Bumped to invalidate every existing session (password change, "sign out everywhere").
    sessionVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
    passwordChangedAt: { type: Date },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };

const User = (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", userSchema);

export default User;
