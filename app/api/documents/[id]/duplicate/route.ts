import { apiRoute, notFound, ok } from "@/lib/api";
import dbConnect, { isValidObjectId } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { enforceRateLimits } from "@/lib/rate-limit";
import { serializeDocument } from "@/lib/serializers";
import DocumentModel from "@/models/Document";

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await params;
  if (!isValidObjectId(id)) throw notFound("Document not found.");
  await enforceRateLimits([{ key: `documents:create:${user._id.toString()}`, limit: 60, windowSeconds: 600 }]);
  await dbConnect();

  const source = await DocumentModel.findOne({ _id: id, userId: user._id }).lean();
  if (!source) throw notFound("Document not found.");

  const copy = await DocumentModel.create({
    userId: user._id,
    title: `Copy of ${source.title}`.slice(0, 200),
    content: source.content,
    templateId: source.templateId,
    category: source.category,
    language: source.language,
    tone: source.tone,
    framework: source.framework,
    wordCount: source.wordCount,
  });
  return ok({ document: serializeDocument(copy.toObject(), { includeContent: false }) }, { status: 201 });
});
