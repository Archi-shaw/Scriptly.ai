import "server-only";
import { excerpt } from "@/lib/text";
import type { GeneratedContentDoc } from "@/models/GeneratedContent";
import type { DocumentDoc } from "@/models/Document";
import type { CreditTransactionDoc } from "@/models/CreditTransaction";

const iso = (value: unknown) => (value ? new Date(value as string | Date).toISOString() : null);

export function serializeGeneration(g: GeneratedContentDoc, options: { includeOutput?: boolean } = {}) {
  const includeOutput = options.includeOutput ?? true;
  return {
    id: g._id.toString(),
    kind: g.kind,
    templateId: g.templateId,
    templateName: g.templateName,
    category: g.category,
    action: g.action ?? null,
    inputs: (g.inputs ?? {}) as Record<string, string>,
    language: g.language,
    tone: g.tone ?? null,
    style: g.style ?? null,
    length: g.length ?? null,
    framework: g.framework ?? null,
    creativity: g.creativity ?? null,
    brandVoice: g.brandVoice ?? null,
    instructions: g.instructions ?? null,
    output: includeOutput ? g.output : undefined,
    preview: excerpt(g.output ?? "", 220),
    wordCount: g.wordCount ?? 0,
    status: g.status,
    errorMessage: g.errorMessage ?? null,
    creditsUsed: g.creditsUsed ?? 0,
    creditsRefunded: g.creditsRefunded ?? 0,
    documentId: g.documentId ? g.documentId.toString() : null,
    createdAt: iso(g.createdAt),
  };
}

export type SerializedGeneration = ReturnType<typeof serializeGeneration>;

export function serializeDocument(d: DocumentDoc, options: { includeContent?: boolean } = {}) {
  const includeContent = options.includeContent ?? true;
  return {
    id: d._id.toString(),
    title: d.title,
    content: includeContent ? d.content : undefined,
    preview: excerpt(d.content ?? "", 200),
    templateId: d.templateId ?? null,
    category: d.category ?? "general",
    language: d.language ?? null,
    tone: d.tone ?? null,
    framework: d.framework ?? null,
    sourceGenerationId: d.sourceGenerationId ? d.sourceGenerationId.toString() : null,
    wordCount: d.wordCount ?? 0,
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  };
}

export type SerializedDocument = ReturnType<typeof serializeDocument>;

export function serializeTransaction(t: CreditTransactionDoc) {
  return {
    id: t._id.toString(),
    type: t.type,
    amount: t.amount,
    balanceAfter: t.balanceAfter,
    status: t.status,
    description: t.description,
    createdAt: iso(t.createdAt),
  };
}

export type SerializedTransaction = ReturnType<typeof serializeTransaction>;

export function paginate(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
