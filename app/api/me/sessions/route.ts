import { apiRoute, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import User from "@/models/User";

/** "Sign out everywhere": invalidates every existing session token for this account. */
export const DELETE = apiRoute(async (req) => {
  const user = await requireUser(req);
  await User.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } });
  return ok({ signedOut: true });
});
