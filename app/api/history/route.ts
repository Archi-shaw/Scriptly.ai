import { z } from "@/lib/zod";
import { apiRoute, ok, readQuery } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { paginate, serializeGeneration } from "@/lib/serializers";
import GeneratedContent from "@/models/GeneratedContent";

const schema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  kind: z.enum(["generate", "refine", "all"]).default("generate"),
  status: z.enum(["completed", "failed", "refunded", "all"]).default("all"),
  category: z.string().max(40).optional(),
  templateId: z.string().max(80).optional(),
});

/** Paginated generation history for the signed-in user. */
export const GET = apiRoute(async (req) => {
  const user = await requireUser(req);
  const query = readQuery(req, schema);

  const filter: Record<string, unknown> = { userId: user._id, status: { $ne: "pending" } };
  if (query.kind !== "all") filter.kind = query.kind;
  if (query.status !== "all") filter.status = query.status;
  if (query.category && query.category !== "all") filter.category = query.category;
  if (query.templateId) filter.templateId = query.templateId;

  const [items, total] = await Promise.all([
    GeneratedContent.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    GeneratedContent.countDocuments(filter),
  ]);

  return ok({
    items: items.map((g) => serializeGeneration(g, { includeOutput: false })),
    ...paginate(query.page, query.limit, total),
  });
});
