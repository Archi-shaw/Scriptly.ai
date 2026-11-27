import { z } from "@/lib/zod";
import { ApiError, apiRoute, getClientIp, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { buildGenerationPrompt } from "@/lib/ai/prompts";
import { runAIOperation } from "@/lib/generation";
import { enforceRateLimits } from "@/lib/rate-limit";
import { serializeGeneration } from "@/lib/serializers";
import { getGenerationCost, getTemplate } from "@/lib/templates/registry";
import { generationSettingsSchema, validateTemplateInputs } from "@/lib/templates/validate";
import { requestIdSchema } from "@/lib/validation";

export const maxDuration = 120;

const schema = z.object({
  templateId: z.string().min(1).max(80),
  inputs: z.record(z.string(), z.string().max(12_000)).default({}),
  settings: generationSettingsSchema,
  requestId: requestIdSchema,
});

/** Generates content from a template. Credits are charged server-side and refunded on failure. */
export const POST = apiRoute(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req, schema, 80_000);

  const template = getTemplate(body.templateId);
  if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND", "That template doesn't exist.");

  const { values, errors } = validateTemplateInputs(template, body.inputs);
  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, "VALIDATION_ERROR", Object.values(errors)[0] ?? "Please check the form.", { fields: errors });
  }

  await enforceRateLimits(
    [
      { key: `ai:user:${user._id.toString()}`, limit: 20, windowSeconds: 60 },
      { key: `ai:user-day:${user._id.toString()}`, limit: 500, windowSeconds: 86_400 },
      { key: `ai:ip:${getClientIp(req)}`, limit: 60, windowSeconds: 60 },
    ],
    "You're generating very quickly. Please wait a moment and try again.",
  );

  const settings = {
    ...body.settings,
    framework: template.fixedFramework ?? (template.supportsFramework ? body.settings.framework : "none"),
  };
  const cost = getGenerationCost(template, settings.length);

  const result = await runAIOperation({
    userId: user._id,
    requestId: body.requestId,
    kind: "generate",
    template: { id: template.id, name: template.name, category: template.category },
    inputs: values,
    settings: {
      language: settings.language,
      tone: settings.tone,
      style: settings.style,
      length: settings.length,
      framework: settings.framework,
      creativity: settings.creativity,
      brandVoice: settings.brandVoice || undefined,
      instructions: settings.instructions || undefined,
    },
    cost,
    prompt: buildGenerationPrompt(template, values, settings),
    description: `Generated: ${template.name}`,
  });

  return ok({
    generation: serializeGeneration(result.generation),
    credits: result.balance,
    reused: result.reused,
    truncated: result.truncated,
  });
});
