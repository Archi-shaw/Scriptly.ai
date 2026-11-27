import { after } from "next/server";
import { apiRoute, getClientIp, ok, readJson } from "@/lib/api";
import dbConnect from "@/lib/db";
import { challengeNotFound, verifyChallenge } from "@/lib/auth/challenges";
import { hashPassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/email/mailer";
import { securityNoticeEmail } from "@/lib/email/templates";
import { enforceRateLimits } from "@/lib/rate-limit";
import { resetPasswordSchema } from "@/lib/validation";
import User from "@/models/User";

/** Completes a password reset and signs the account out everywhere. */
export const POST = apiRoute(async (req) => {
  const body = await readJson(req, resetPasswordSchema);
  await enforceRateLimits([{ key: `reset:ip:${getClientIp(req)}`, limit: 20, windowSeconds: 900 }]);

  const challenge = await verifyChallenge(body.challengeToken, body.code, ["password_reset"]);
  if (!challenge.userId) throw challengeNotFound();

  await dbConnect();
  const passwordHash = await hashPassword(body.password);
  const user = await User.findOneAndUpdate(
    { _id: challenge.userId, status: "active" },
    {
      // Completing the flow also proves ownership of the email address.
      $set: { passwordHash, passwordChangedAt: new Date(), emailVerified: true },
      $inc: { sessionVersion: 1 },
    },
    { new: true },
  ).lean();
  if (!user) throw challengeNotFound();

  after(async () => {
    try {
      await sendEmail(
        securityNoticeEmail({
          to: user.email,
          name: user.name,
          subject: "Your Scriptly.ai password was changed",
          title: "Password changed",
          message: "Your password was just reset and all other sessions were signed out.",
        }),
      );
    } catch (error) {
      console.error("[auth] password change notice failed", error instanceof Error ? error.message : error);
    }
  });

  return ok({ reset: true });
});
