import { z } from "@/lib/zod";
import { ApiError, apiRoute, ok, readJson, readQuery } from "@/lib/api";
import dbConnect from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { enforceRateLimits } from "@/lib/rate-limit";
import { paginate, serializeDocument } from "@/lib/serializers";
import { FRAMEWORK_IDS, LANGUAGE_IDS, TONE_IDS } from "@/lib/templates/options";
import { getTemplate } from "@/lib/templates/registry";
import { countWords, deriveTitle } from "@/lib/text";
import { escapeRegex, objectIdSchema } from "@/lib/validation";
import DocumentModel, { MAX_DOCUMENT_CHARS } from "@/models/Document";
import GeneratedContent from "@/models/GeneratedContent";

const listSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  category: z.string().max(40).optional(),
  sort: z.enum(["updated", "created", "title"]).default("updated"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

const SORT_FIELDS = { updated: "updatedAt", created: "createdAt", title: "title" } as const;

export const GET = apiRoute(async (req) => {
  const user = await requireUser(req);
  const query = readQuery(req, listSchema);

  const filter: Record<string, unknown> = { userId: user._id };
  if (query.category && query.category !== "all") filter.category = query.category;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ title: pattern }, { content: pattern }];
  }

  const direction = query.order === "asc" ? 1 : -1;
  const [items, total] = await Promise.all([
    DocumentModel.find(filter)
      .sort({ [SORT_FIELDS[query.sort]]: direction, _id: direction })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    DocumentModel.countDocuments(filter),
  ]);

  return ok({
    items: items.map((d) => serializeDocument(d, { includeContent: false })),
    ...paginate(query.page, query.limit, total),
  });
});

const createSchema = z.object({
  title: z.string().trim().min(1, "Title can't be empty.").max(200, "Title must be 200 characters or fewer.").optional(),
  content: z.string().max(MAX_DOCUMENT_CHARS, "This document is too long.").default(""),
  templateId: z.string().max(80).optional(),
  generationId: objectIdSchema.optional(),
  language: z.enum(LANGUAGE_IDS).optional(),
  tone: z.enum(TONE_IDS).optional(),
  framework: z.enum(FRAMEWORK_IDS).optional(),
});

export const POST = apiRoute(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req, createSchema, MAX_DOCUMENT_CHARS + 10_000);
  await enforceRateLimits([{ key: `documents:create:${user._id.toString()}`, limit: 60, windowSeconds: 600 }]);
  await dbConnect();

  // A generation can only be linked by its owner.
  let generation = null;
  if (body.generationId) {
    generation = await GeneratedContent.findOne({ _id: body.generationId, userId: user._id }).lean();
    if (!generation) throw new ApiError(404, "NOT_FOUND", "Generation not found.");
  }

  const template = getTemplate(body.templateId ?? generation?.templateId ?? "");
  const document = await DocumentModel.create({
    userId: user._id,
    title: body.title ?? deriveTitle(body.content, template ? `${template.name} draft` : "Untitled document"),
    content: body.content,
    templateId: template?.id,
    category: template?.category ?? "general",
    language: body.language ?? generation?.language,
    tone: body.tone ?? generation?.tone ?? undefined,
    framework: body.framework ?? generation?.framework ?? undefined,
    sourceGenerationId: generation?._id,
    wordCount: countWords(body.content),
  });

  if (generation) {
    await GeneratedContent.updateOne({ _id: generation._id, userId: user._id }, { $set: { documentId: document._id } });
  }

  return ok({ document: serializeDocument(document.toObject()) }, { status: 201 });
});
