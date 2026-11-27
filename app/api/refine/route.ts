import { z } from "@/lib/zod";
import { ApiError, apiRoute, getClientIp, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { buildRefinePrompt, splitVariants } from "@/lib/ai/prompts";
import { runAIOperation } from "@/lib/generation";
import { enforceRateLimits } from "@/lib/rate-limit";
import { serializeGeneration } from "@/lib/serializers";
import { LANGUAGE_IDS, REFINE_ACTIONS, REFINE_ACTION_IDS, TONE_IDS, getRefineCost } from "@/lib/templates/options";
import { getTemplate } from "@/lib/templates/registry";
import { requestIdSchema } from "@/lib/validation";

export const maxDuration = 120;

const schema = z
  .object({
    action: z.enum(REFINE_ACTION_IDS),
    content: z.string().trim().min(1, "There is no content to work with yet.").max(30_000, "The content is too long to refine at once (30,000 characters max). Select a part of it instead."),
    tone: z.enum(TONE_IDS).optional(),
    language: z.enum(LANGUAGE_IDS).optional(),
    templateId: z.string().max(80).optional(),
    requestId: requestIdSchema,
  })
  .refine((v) => v.action !== "tone" || !!v.tone, { path: ["tone"], message: "Choose a tone." });

/** AI editor actions: improve, expand, shorten, rewrite, change tone, fix grammar, continue, variants. */
export const POST = apiRoute(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req, schema, 70_000);

  await enforceRateLimits(
    [
      { key: `ai:user:${user._id.toString()}`, limit: 20, windowSeconds: 60 },
      { key: `ai:user-day:${user._id.toString()}`, limit: 500, windowSeconds: 86_400 },
      { key: `ai:ip:${getClientIp(req)}`, limit: 60, windowSeconds: 60 },
    ],
    "You're making changes very quickly. Please wait a moment and try again.",
  );

  const template = body.templateId ? getTemplate(body.templateId) : undefined;
  const actionMeta = REFINE_ACTIONS.find((a) => a.id === body.action);
  if (!actionMeta) throw new ApiError(400, "VALIDATION_ERROR", "Unknown action.");

  const result = await runAIOperation({
    userId: user._id,
    requestId: body.requestId,
    kind: "refine",
    action: body.action,
    template: {
      id: template?.id ?? "editor",
      name: template?.name ?? "Editor",
      category: template?.category ?? "writing",
    },
    inputs: { content: body.content },
    settings: { language: body.language ?? "en-US", tone: body.tone },
    cost: getRefineCost(body.action),
    prompt: buildRefinePrompt({
      action: body.action,
      content: body.content,
      language: body.language,
      tone: body.tone,
      context: template?.name,
    }),
    description: `Editor: ${actionMeta.label}`,
  });

  const output = result.generation.output ?? "";
  return ok({
    generation: serializeGeneration(result.generation, { includeOutput: false }),
    action: body.action,
    output,
    variants: body.action === "variants" ? splitVariants(output) : undefined,
    credits: result.balance,
    truncated: result.truncated,
  });
});
