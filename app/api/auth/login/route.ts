import { ApiError, apiRoute, getClientIp, getUserAgent, ok, readJson } from "@/lib/api";
import dbConnect from "@/lib/db";
import { createChallenge } from "@/lib/auth/challenges";
import { verifyHuman } from "@/lib/auth/turnstile";
import { verifyPassword } from "@/lib/auth/password";
import { enforceRateLimits, hashedKey } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";
import User from "@/models/User";

/**
 * Login stage 1: check email + password and email a one-time code.
 * No session is created here; stage 2 exchanges the code for a session.
 */
export const POST = apiRoute(async (req) => {
  const body = await readJson(req, loginSchema);
  const ip = getClientIp(req);
  await enforceRateLimits(
    [
      { key: `login:ip:${ip}`, limit: 20, windowSeconds: 900 },
      { key: `login:email:${hashedKey(body.email)}`, limit: 10, windowSeconds: 900 },
    ],
    "Too many sign-in attempts. Please wait a few minutes and try again.",
  );
  await verifyHuman(body.turnstileToken, { action: "login", ip });

  await dbConnect();
  const user = await User.findOne({ email: body.email }).select("+passwordHash name email status").lean();
  const passwordOk = await verifyPassword(body.password, user?.passwordHash);
  if (!user || !passwordOk) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");
  }
  if (user.status !== "active") {
    throw new ApiError(403, "ACCOUNT_UNAVAILABLE", "This account is not available. Please contact support.");
  }

  const challenge = await createChallenge({
    purpose: "login",
    email: user.email,
    name: user.name,
    userId: user._id,
    ip,
    userAgent: getUserAgent(req),
  });
  return ok(challenge);
});
