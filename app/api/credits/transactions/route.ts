import { z } from "@/lib/zod";
import { apiRoute, ok, readQuery } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { paginate, serializeTransaction } from "@/lib/serializers";
import { CREDIT_TRANSACTION_TYPES } from "@/models/CreditTransaction";
import CreditTransaction from "@/models/CreditTransaction";

const schema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  type: z.enum([...CREDIT_TRANSACTION_TYPES, "all"]).default("all"),
});

export const GET = apiRoute(async (req) => {
  const user = await requireUser(req);
  const query = readQuery(req, schema);
  const filter: Record<string, unknown> = { userId: user._id };
  if (query.type !== "all") filter.type = query.type;

  const [items, total] = await Promise.all([
    CreditTransaction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    CreditTransaction.countDocuments(filter),
  ]);

  return ok({ items: items.map(serializeTransaction), ...paginate(query.page, query.limit, total) });
});
