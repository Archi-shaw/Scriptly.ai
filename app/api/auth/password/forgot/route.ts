import { apiRoute, getClientIp, getUserAgent, ok, readJson } from "@/lib/api";
import dbConnect from "@/lib/db";
import { createChallenge } from "@/lib/auth/challenges";
import { verifyHuman } from "@/lib/auth/turnstile";
import { enforceRateLimits, hashedKey } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/validation";
import User from "@/models/User";

/**
 * Starts a password reset. The response is identical whether or not the
 * email has an account (unknown emails get a decoy session and no email).
 */
export const POST = apiRoute(async (req) => {
  const { email, turnstileToken } = await readJson(req, forgotPasswordSchema);
  const ip = getClientIp(req);
  await enforceRateLimits(
    [
      { key: `forgot:ip:${ip}`, limit: 10, windowSeconds: 3600 },
      { key: `forgot:email:${hashedKey(email)}`, limit: 5, windowSeconds: 3600 },
    ],
    "Too many reset requests. Please wait a while and try again.",
  );
  await verifyHuman(turnstileToken, { action: "forgot_password", ip });

  await dbConnect();
  const user = await User.findOne({ email, status: "active" }).select("name email").lean();
  const challenge = await createChallenge({
    purpose: "password_reset",
    email,
    name: user?.name,
    userId: user?._id,
    ip,
    userAgent: getUserAgent(req),
    skipEmail: !user,
    sendInBackground: true,
  });
  return ok(challenge);
});
