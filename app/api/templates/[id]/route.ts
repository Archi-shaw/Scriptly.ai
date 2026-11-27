import { apiRoute, notFound, ok } from "@/lib/api";
import { getCategory, getGenerationCost, getTemplate } from "@/lib/templates/registry";

export const GET = apiRoute(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const template = getTemplate(id);
  if (!template) throw notFound("Template not found.");
  return ok({
    template: {
      ...template,
      credits: {
        short: getGenerationCost(template, "short"),
        medium: getGenerationCost(template, "medium"),
        long: getGenerationCost(template, "long"),
      },
    },
    category: getCategory(template.category),
  });
});
