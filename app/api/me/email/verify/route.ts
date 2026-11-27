import { after } from "next/server";
import { ApiError, apiRoute, ok, readJson } from "@/lib/api";
import dbConnect, { isDuplicateKeyError } from "@/lib/db";
import { requireUser, serializeUser, userHasPassword } from "@/lib/auth/session";
import { challengeNotFound, verifyChallenge } from "@/lib/auth/challenges";
import { sendEmail } from "@/lib/email/mailer";
import { securityNoticeEmail } from "@/lib/email/templates";
import { enforceRateLimits } from "@/lib/rate-limit";
import { otpVerifySchema } from "@/lib/validation";
import User from "@/models/User";

/** Completes an email change after the code sent to the new address is verified. */
export const POST = apiRoute(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req, otpVerifySchema);
  await enforceRateLimits([{ key: `email-verify:${user._id.toString()}`, limit: 20, windowSeconds: 900 }]);

  const challenge = await verifyChallenge(body.challengeToken, body.code, ["email_change"]);
  // The challenge must belong to the signed-in user.
  if (!challenge.userId || challenge.userId.toString() !== user._id.toString() || !challenge.payload?.newEmail) {
    throw challengeNotFound();
  }

  await dbConnect();
  const previousEmail = user.email;
  let updated;
  try {
    updated = await User.findByIdAndUpdate(
      user._id,
      { $set: { email: challenge.payload.newEmail, emailVerified: true, emailVerifiedAt: new Date() } },
      { new: true },
    ).lean();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "EMAIL_TAKEN", "Another account already uses this email address.");
    }
    throw error;
  }
  if (!updated) throw new ApiError(404, "USER_NOT_FOUND", "Account not found.");

  after(async () => {
    try {
      await sendEmail(
        securityNoticeEmail({
          to: previousEmail,
          name: updated.name,
          subject: "Your Scriptly.ai email address was changed",
          title: "Email address changed",
          message: `The email address on your Scriptly.ai account was changed to ${updated.email}.`,
        }),
      );
    } catch (error) {
      console.error("[auth] email change notice failed", error instanceof Error ? error.message : error);
    }
  });

  return ok({ user: serializeUser(updated, { hasPassword: await userHasPassword(updated._id) }) });
});
