import mongoose, { Schema, type InferSchemaType, type Model, type Types } from "mongoose";

export const MAX_DOCUMENT_CHARS = 200_000;

/** A saved, editable piece of content owned by a user ("My Documents"). */
const documentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200, default: "Untitled document" },
    content: { type: String, default: "", maxlength: MAX_DOCUMENT_CHARS },
    templateId: { type: String, maxlength: 80 },
    category: { type: String, maxlength: 40, default: "general" },
    language: { type: String, maxlength: 20 },
    tone: { type: String, maxlength: 40 },
    framework: { type: String, maxlength: 20 },
    sourceGenerationId: { type: Schema.Types.ObjectId, ref: "GeneratedContent" },
    wordCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

documentSchema.index({ userId: 1, updatedAt: -1 });
documentSchema.index({ userId: 1, createdAt: -1 });
documentSchema.index({ userId: 1, category: 1, updatedAt: -1 });

export type DocumentDoc = InferSchemaType<typeof documentSchema> & { _id: Types.ObjectId };

const DocumentModel =
  (mongoose.models.Document as Model<DocumentDoc>) || mongoose.model<DocumentDoc>("Document", documentSchema);

export default DocumentModel;
