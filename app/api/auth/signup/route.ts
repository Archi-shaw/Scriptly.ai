import { ApiError, apiRoute, getClientIp, getUserAgent, ok, readJson } from "@/lib/api";
import dbConnect from "@/lib/db";
import { createChallenge } from "@/lib/auth/challenges";
import { verifyHuman } from "@/lib/auth/turnstile";
import { hashPassword } from "@/lib/auth/password";
import { enforceRateLimits, hashedKey } from "@/lib/rate-limit";
import { signupSchema } from "@/lib/validation";
import User from "@/models/User";

/**
 * Signup stage 1: validate, hash the password and email a verification code.
 * The account itself is created only after the code is verified (stage 2,
 * NextAuth "otp" provider).
 */
export const POST = apiRoute(async (req) => {
  const body = await readJson(req, signupSchema);
  const ip = getClientIp(req);
  await enforceRateLimits(
    [
      { key: `signup:ip:${ip}`, limit: 10, windowSeconds: 3600 },
      { key: `signup:email:${hashedKey(body.email)}`, limit: 5, windowSeconds: 3600 },
    ],
    "Too many signup attempts. Please wait a while and try again.",
  );
  await verifyHuman(body.turnstileToken, { action: "signup", ip });

  await dbConnect();
  if (await User.exists({ email: body.email })) {
    throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists. Try signing in instead.");
  }

  const passwordHash = await hashPassword(body.password);
  const challenge = await createChallenge({
    purpose: "signup",
    email: body.email,
    name: body.name,
    payload: { name: body.name, passwordHash },
    ip,
    userAgent: getUserAgent(req),
  });
  return ok(challenge, { status: 201 });
});
