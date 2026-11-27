import { z } from "@/lib/zod";
import { apiRoute, ok, readQuery } from "@/lib/api";
import { TEMPLATE_CATEGORIES, getGenerationCost, searchTemplates } from "@/lib/templates/registry";

const querySchema = z.object({
  q: z.string().max(100).optional().default(""),
  category: z.string().max(40).optional(),
});

/** Public template catalogue (metadata only; AI instructions stay server-side). */
export const GET = apiRoute(async (req) => {
  const { q, category } = readQuery(req, querySchema);
  const templates = searchTemplates(q, category).map((t) => ({
    ...t,
    credits: { short: getGenerationCost(t, "short"), medium: getGenerationCost(t, "medium"), long: getGenerationCost(t, "long") },
  }));
  return ok({ categories: TEMPLATE_CATEGORIES, templates, total: templates.length });
});
