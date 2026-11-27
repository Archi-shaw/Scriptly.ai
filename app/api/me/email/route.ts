import { z } from "@/lib/zod";
import { ApiError, apiRoute, getClientIp, getUserAgent, ok, readJson } from "@/lib/api";
import dbConnect from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { createChallenge } from "@/lib/auth/challenges";
import { verifyPassword } from "@/lib/auth/password";
import { enforceRateLimits } from "@/lib/rate-limit";
import { emailSchema } from "@/lib/validation";
import User from "@/models/User";

const schema = z.object({
  newEmail: emailSchema,
  password: z.string().max(200).optional(),
});

/** Starts an email change: a code is sent to the NEW address and must be verified. */
export const POST = apiRoute(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req, schema);
  await enforceRateLimits(
    [{ key: `email-change:${user._id.toString()}`, limit: 5, windowSeconds: 3600 }],
    "Too many email change requests. Please try again later.",
  );

  if (body.newEmail === user.email) {
    throw new ApiError(400, "SAME_EMAIL", "That's already your email address.");
  }

  await dbConnect();
  const withHash = await User.findById(user._id).select("+passwordHash").lean();
  if (withHash?.passwordHash) {
    if (!body.password || !(await verifyPassword(body.password, withHash.passwordHash))) {
      throw new ApiError(403, "INVALID_PASSWORD", "Your current password is incorrect.");
    }
  }
  if (await User.exists({ email: body.newEmail })) {
    throw new ApiError(409, "EMAIL_TAKEN", "Another account already uses this email address.");
  }

  const challenge = await createChallenge({
    purpose: "email_change",
    email: body.newEmail,
    name: user.name,
    userId: user._id,
    payload: { newEmail: body.newEmail },
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  });
  return ok(challenge, { status: 201 });
});
