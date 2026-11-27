import { z } from "@/lib/zod";
import { ApiError, apiRoute, ok, readJson } from "@/lib/api";
import dbConnect, { withOptionalTransaction } from "@/lib/db";
import { requireUser, serializeUser, userHasPassword } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { getFeatureFlags } from "@/lib/features";
import { enforceRateLimits } from "@/lib/rate-limit";
import { nameSchema } from "@/lib/validation";
import User from "@/models/User";
import DocumentModel from "@/models/Document";
import GeneratedContent from "@/models/GeneratedContent";
import AuthChallenge from "@/models/AuthChallenge";

export const GET = apiRoute(async (req) => {
  const user = await requireUser(req);
  return ok({
    user: serializeUser(user, { hasPassword: await userHasPassword(user._id) }),
    features: getFeatureFlags(),
  });
});

// Only whitelisted fields can be edited here; credits, email and role are never accepted.
const updateSchema = z.object({ name: nameSchema }).strict();

export const PATCH = apiRoute(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req, updateSchema);
  const updated = await User.findByIdAndUpdate(user._id, { $set: { name: body.name } }, { new: true }).lean();
  if (!updated) throw new ApiError(404, "USER_NOT_FOUND", "Account not found.");
  return ok({ user: serializeUser(updated, { hasPassword: await userHasPassword(updated._id) }) });
});

const deleteSchema = z.object({
  confirmation: z.literal("DELETE", { error: 'Type "DELETE" to confirm.' }),
  password: z.string().max(200).optional(),
});

/** Permanently deletes the account and its content. Requires the password when one is set. */
export const DELETE = apiRoute(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req, deleteSchema);
  await enforceRateLimits([{ key: `delete-account:${user._id.toString()}`, limit: 5, windowSeconds: 3600 }]);

  await dbConnect();
  const withHash = await User.findById(user._id).select("+passwordHash").lean();
  if (withHash?.passwordHash) {
    if (!body.password || !(await verifyPassword(body.password, withHash.passwordHash))) {
      throw new ApiError(403, "INVALID_PASSWORD", "Your password is incorrect.");
    }
  }

  // Orders and the credit ledger are kept (they reference only the user id) for accounting.
  await withOptionalTransaction(async (txn) => {
    const session = txn ?? undefined;
    await DocumentModel.deleteMany({ userId: user._id }, { session });
    await GeneratedContent.deleteMany({ userId: user._id }, { session });
    await AuthChallenge.deleteMany({ $or: [{ userId: user._id }, { email: user.email }] }, { session });
    await User.deleteOne({ _id: user._id }, { session });
  });

  return ok({ deleted: true });
});
