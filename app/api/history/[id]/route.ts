import { ApiError, apiRoute, notFound, ok } from "@/lib/api";
import dbConnect, { isValidObjectId } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { serializeGeneration } from "@/lib/serializers";
import GeneratedContent from "@/models/GeneratedContent";

type Ctx = { params: Promise<{ id: string }> };

async function generationId(ctx: Ctx): Promise<string> {
  const { id } = await ctx.params;
  if (!isValidObjectId(id)) throw notFound("Generation not found.");
  return id;
}

export const GET = apiRoute(async (req, ctx: Ctx) => {
  const user = await requireUser(req);
  const id = await generationId(ctx);
  await dbConnect();
  const generation = await GeneratedContent.findOne({ _id: id, userId: user._id }).lean();
  if (!generation) throw notFound("Generation not found.");
  return ok({ generation: serializeGeneration(generation) });
});

/** Removes an item from history (saved documents are not affected). */
export const DELETE = apiRoute(async (req, ctx: Ctx) => {
  const user = await requireUser(req);
  const id = await generationId(ctx);
  await dbConnect();
  const generation = await GeneratedContent.findOne({ _id: id, userId: user._id }).select("status").lean();
  if (!generation) throw notFound("Generation not found.");
  if (generation.status === "pending") {
    throw new ApiError(409, "GENERATION_IN_PROGRESS", "This generation is still running.");
  }
  await GeneratedContent.deleteOne({ _id: id, userId: user._id });
  return ok({ deleted: true });
});
