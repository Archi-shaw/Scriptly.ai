import mongoose, { Schema, type InferSchemaType, type Model, type Types } from "mongoose";

const integer = {
  validator: Number.isInteger,
  message: "{PATH} must be a whole number",
};

const creditPackageSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]{2,40}$/ },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    credits: { type: Number, required: true, min: 1, validate: integer },
    bonusCredits: { type: Number, default: 0, min: 0, validate: integer },
    // Price in the currency's minor unit (paise, cents) to avoid floating point errors.
    priceMinor: { type: Number, required: true, min: 0, validate: integer },
    currency: { type: String, required: true, uppercase: true, enum: ["INR", "USD", "EUR", "GBP"], default: "INR" },
    features: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

creditPackageSchema.index({ isActive: 1, sortOrder: 1 });

export type CreditPackageDoc = InferSchemaType<typeof creditPackageSchema> & { _id: Types.ObjectId };

const CreditPackage =
  (mongoose.models.CreditPackage as Model<CreditPackageDoc>) ||
  mongoose.model<CreditPackageDoc>("CreditPackage", creditPackageSchema);

export default CreditPackage;
