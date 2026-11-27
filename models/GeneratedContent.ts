import mongoose, { Schema, type InferSchemaType, type Model, type Types } from "mongoose";

export const GENERATION_STATUSES = ["pending", "completed", "failed", "refunded"] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

/** One AI operation (a template generation or an editor refinement) and its outcome. */
const generatedContentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["generate", "refine"], required: true },
    templateId: { type: String, required: true, maxlength: 80 },
    templateName: { type: String, required: true, maxlength: 120 },
    category: { type: String, required: true, maxlength: 40 },
    action: { type: String, maxlength: 40 },
    inputs: { type: Schema.Types.Mixed, default: {} },
    language: { type: String, required: true, maxlength: 20 },
    tone: { type: String, maxlength: 40 },
    style: { type: String, maxlength: 40 },
    length: { type: String, maxlength: 20 },
    framework: { type: String, maxlength: 20 },
    creativity: { type: String, maxlength: 20 },
    // Optional generation context, kept so a result can be regenerated faithfully.
    brandVoice: { type: String, maxlength: 1500 },
    instructions: { type: String, maxlength: 1500 },
    output: { type: String, default: "" },
    wordCount: { type: Number, default: 0 },
    status: { type: String, enum: GENERATION_STATUSES, default: "pending" },
    errorCode: { type: String, maxlength: 60 },
    errorMessage: { type: String, maxlength: 500 },
    creditsUsed: { type: Number, default: 0, min: 0 },
    creditsRefunded: { type: Number, default: 0, min: 0 },
    provider: { type: String, maxlength: 40 },
    model: { type: String, maxlength: 80 },
    usage: {
      inputTokens: { type: Number },
      outputTokens: { type: Number },
    },
    durationMs: { type: Number },
    // Client-generated id: a retried request maps to the same record and is charged once.
    requestId: { type: String, required: true, maxlength: 64 },
    documentId: { type: Schema.Types.ObjectId, ref: "Document" },
  },
  { timestamps: true, minimize: false },
);

generatedContentSchema.index({ userId: 1, requestId: 1 }, { unique: true });
generatedContentSchema.index({ userId: 1, createdAt: -1 });
generatedContentSchema.index({ userId: 1, kind: 1, createdAt: -1 });
generatedContentSchema.index({ status: 1, createdAt: 1 });

export type GeneratedContentDoc = InferSchemaType<typeof generatedContentSchema> & { _id: Types.ObjectId };

const GeneratedContent =
  (mongoose.models.GeneratedContent as Model<GeneratedContentDoc>) ||
  mongoose.model<GeneratedContentDoc>("GeneratedContent", generatedContentSchema);

export default GeneratedContent;
