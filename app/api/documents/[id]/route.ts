import { z } from "@/lib/zod";
import { ApiError, apiRoute, notFound, ok, readJson } from "@/lib/api";
import dbConnect, { isValidObjectId } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { serializeDocument } from "@/lib/serializers";
import { countWords } from "@/lib/text";
import DocumentModel, { MAX_DOCUMENT_CHARS } from "@/models/Document";
import GeneratedContent from "@/models/GeneratedContent";

type Ctx = { params: Promise<{ id: string }> };

async function documentId(ctx: Ctx): Promise<string> {
  const { id } = await ctx.params;
  // Malformed ids are treated as "not found" (never a 500).
  if (!isValidObjectId(id)) throw notFound("Document not found.");
  return id;
}

export const GET = apiRoute(async (req, ctx: Ctx) => {
  const user = await requireUser(req);
  const id = await documentId(ctx);
  await dbConnect();
  // Ownership is part of the query: other users' documents are indistinguishable from missing ones.
  const document = await DocumentModel.findOne({ _id: id, userId: user._id }).lean();
  if (!document) throw notFound("Document not found.");
  return ok({ document: serializeDocument(document) });
});

const updateSchema = z
  .object({
    title: z.string().trim().min(1, "Title can't be empty.").max(200, "Title must be 200 characters or fewer.").optional(),
    content: z.string().max(MAX_DOCUMENT_CHARS, "This document is too long.").optional(),
    /** The updatedAt the client last saw; a newer server copy means a conflicting edit. */
    baseUpdatedAt: z.iso.datetime().optional(),
  })
  .refine((v) => v.title !== undefined || v.content !== undefined, { message: "Nothing to update." });

export const PATCH = apiRoute(async (req, ctx: Ctx) => {
  const user = await requireUser(req);
  const id = await documentId(ctx);
  const body = await readJson(req, updateSchema, MAX_DOCUMENT_CHARS + 10_000);
  await dbConnect();

  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.content !== undefined) {
    update.content = body.content;
    update.wordCount = countWords(body.content);
  }

  const filter: Record<string, unknown> = { _id: id, userId: user._id };
  if (body.baseUpdatedAt && body.content !== undefined) filter.updatedAt = { $lte: new Date(body.baseUpdatedAt) };

  const document = await DocumentModel.findOneAndUpdate(filter, { $set: update }, { new: true, runValidators: true }).lean();
  if (!document) {
    const current = await DocumentModel.findOne({ _id: id, userId: user._id }).lean();
    if (!current) throw notFound("Document not found.");
    throw new ApiError(409, "EDIT_CONFLICT", "This document was changed in another tab or device.", {
      document: serializeDocument(current),
    });
  }
  return ok({ document: serializeDocument(document) });
});

export const DELETE = apiRoute(async (req, ctx: Ctx) => {
  const user = await requireUser(req);
  const id = await documentId(ctx);
  await dbConnect();
  const deleted = await DocumentModel.findOneAndDelete({ _id: id, userId: user._id }).lean();
  if (!deleted) throw notFound("Document not found.");
  await GeneratedContent.updateMany({ userId: user._id, documentId: deleted._id }, { $unset: { documentId: 1 } });
  return ok({ deleted: true });
});
