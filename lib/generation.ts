import "server-only";
import type { Types } from "mongoose";
import dbConnect, { isDuplicateKeyError } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { getAIProvider } from "@/lib/ai";
import { AIError, type AIProvider } from "@/lib/ai/types";
import type { BuiltPrompt } from "@/lib/ai/prompts";
import { chargeCredits, refundCredits } from "@/lib/credits";
import { countWords } from "@/lib/text";
import GeneratedContent, { type GeneratedContentDoc } from "@/models/GeneratedContent";
import CreditTransaction from "@/models/CreditTransaction";

/** Pending operations older than this were interrupted (crash/timeout) and get refunded. */
const STALE_AFTER_MS = 15 * 60 * 1000;

export interface AIOperation {
  userId: Types.ObjectId;
  requestId: string;
  kind: "generate" | "refine";
  template: { id: string; name: string; category: string };
  action?: string;
  inputs: Record<string, string>;
  settings: {
    language: string;
    tone?: string;
    style?: string;
    length?: string;
    framework?: string;
    creativity?: string;
    brandVoice?: string;
    instructions?: string;
  };
  cost: number;
  prompt: BuiltPrompt;
  /** Ledger description, e.g. "Generated: Blog Post Generator". */
  description: string;
}

export interface AIOperationResult {
  generation: GeneratedContentDoc;
  balance: number | null;
  reused: boolean;
  truncated: boolean;
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AIError) return new ApiError(error.status, error.code, error.message);
  return new ApiError(500, "GENERATION_FAILED", "Something went wrong while generating. Your credits were refunded.");
}

/** Refunds a failed or interrupted operation exactly once (refund first, then mark). */
async function refundOperation(generationId: Types.ObjectId, userId: Types.ObjectId, error: ApiError): Promise<void> {
  const charge = await CreditTransaction.findOne({ idempotencyKey: `gen:${generationId.toString()}` }).lean();
  const charged = charge ? Math.abs(charge.amount) : 0;
  if (charged > 0) {
    await refundCredits(userId, charged, {
      description: "Refund: generation failed",
      idempotencyKey: `refund:${generationId.toString()}`,
      contentId: generationId,
    });
  }
  await GeneratedContent.updateOne(
    { _id: generationId, status: "pending" },
    {
      $set: {
        status: charged > 0 ? "refunded" : "failed",
        creditsRefunded: charged,
        errorCode: error.code,
        errorMessage: error.message.slice(0, 500),
      },
    },
  );
}

/** Refunds this user's operations that were interrupted mid-flight. */
export async function recoverStaleOperations(userId: Types.ObjectId): Promise<void> {
  const stale = await GeneratedContent.find({
    userId,
    status: "pending",
    createdAt: { $lt: new Date(Date.now() - STALE_AFTER_MS) },
  })
    .select("_id")
    .limit(20)
    .lean();
  for (const item of stale) {
    await refundOperation(item._id, userId, new ApiError(504, "INTERRUPTED", "The operation was interrupted."));
  }
}

/**
 * Runs one AI operation with server-side credit accounting:
 * pending record (idempotent per requestId) → atomic charge → AI call →
 * completed record, or refund + failed record on any error.
 */
export async function runAIOperation(op: AIOperation, provider?: AIProvider): Promise<AIOperationResult> {
  // Fail fast (and charge nothing) when AI isn't configured.
  let ai: AIProvider;
  try {
    ai = provider ?? getAIProvider();
  } catch (error) {
    throw toApiError(error);
  }

  await dbConnect();
  await recoverStaleOperations(op.userId);

  let generation: GeneratedContentDoc;
  try {
    const created = await GeneratedContent.create({
      userId: op.userId,
      kind: op.kind,
      templateId: op.template.id,
      templateName: op.template.name,
      category: op.template.category,
      action: op.action,
      inputs: op.inputs,
      ...op.settings,
      status: "pending",
      requestId: op.requestId,
      provider: ai.name,
      model: ai.model,
    });
    generation = created.toObject() as GeneratedContentDoc;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    // Same requestId seen before: never charge twice.
    const existing = await GeneratedContent.findOne({ userId: op.userId, requestId: op.requestId }).lean();
    if (existing?.status === "completed") {
      return { generation: existing, balance: null, reused: true, truncated: false };
    }
    if (existing?.status === "pending") {
      throw new ApiError(409, "GENERATION_IN_PROGRESS", "This request is already being processed.");
    }
    throw new ApiError(409, "REQUEST_ALREADY_FAILED", "This request already failed. Please try again.");
  }

  let balance: number;
  try {
    const charge = await chargeCredits(op.userId, op.cost, {
      description: op.description,
      idempotencyKey: `gen:${generation._id.toString()}`,
      contentId: generation._id,
    });
    balance = charge.balance;
    await GeneratedContent.updateOne({ _id: generation._id }, { $set: { creditsUsed: op.cost } });
  } catch (error) {
    const apiError = toApiError(error);
    await GeneratedContent.updateOne(
      { _id: generation._id },
      { $set: { status: "failed", errorCode: apiError.code, errorMessage: apiError.message.slice(0, 500) } },
    );
    throw apiError;
  }

  try {
    const result = await ai.generate({
      system: op.prompt.system,
      prompt: op.prompt.prompt,
      maxOutputTokens: op.prompt.maxOutputTokens,
      temperature: op.prompt.temperature,
    });
    const completed = await GeneratedContent.findOneAndUpdate(
      { _id: generation._id, status: "pending" },
      {
        $set: {
          status: "completed",
          output: result.text,
          wordCount: countWords(result.text),
          model: result.model,
          usage: result.usage,
          durationMs: result.durationMs,
        },
      },
      { new: true },
    ).lean();
    if (!completed) throw new ApiError(500, "GENERATION_FAILED", "The operation could not be saved.");
    return { generation: completed, balance, reused: false, truncated: result.truncated };
  } catch (error) {
    const apiError = toApiError(error);
    if (!(error instanceof AIError) && !(error instanceof ApiError)) {
      console.error("[generation] unexpected failure", error);
    }
    let refundNote = "Your credits were refunded.";
    try {
      await refundOperation(generation._id, op.userId, apiError);
    } catch (refundError) {
      // The record stays "pending" and recoverStaleOperations() refunds it later.
      console.error("[generation] refund failed; it will be retried automatically", refundError);
      refundNote = "Your credits will be refunded automatically.";
    }
    throw new ApiError(apiError.status, apiError.code, `${apiError.message} ${refundNote}`, apiError.details);
  }
}
