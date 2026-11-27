import { after } from "next/server";
import { z } from "@/lib/zod";
import { ApiError, apiRoute, ok, readJson } from "@/lib/api";
import dbConnect from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/email/mailer";
import { securityNoticeEmail } from "@/lib/email/templates";
import { enforceRateLimits } from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/validation";
import User from "@/models/User";

const schema = z
  .object({
    currentPassword: z.string({ error: "Enter your current password." }).min(1, "Enter your current password.").max(200),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from your current one.",
  });

/**
 * Changes the password and revokes every session (including this one), so
 * the user signs in again with the new password.
 */
export const POST = apiRoute(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req, schema);
  await enforceRateLimits(
    [{ key: `password-change:${user._id.toString()}`, limit: 5, windowSeconds: 900 }],
    "Too many attempts. Please wait a few minutes and try again.",
  );

  await dbConnect();
  const withHash = await User.findById(user._id).select("+passwordHash").lean();
  if (!withHash?.passwordHash) {
    throw new ApiError(
      400,
      "NO_PASSWORD",
      "Your account doesn't have a password yet. Use “Forgot password” on the sign-in page to set one.",
    );
  }
  if (!(await verifyPassword(body.currentPassword, withHash.passwordHash))) {
    throw new ApiError(403, "INVALID_PASSWORD", "Your current password is incorrect.");
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(body.newPassword), passwordChangedAt: new Date() }, $inc: { sessionVersion: 1 } },
  );

  after(async () => {
    try {
      await sendEmail(
        securityNoticeEmail({
          to: user.email,
          name: user.name,
          subject: "Your Scriptly.ai password was changed",
          title: "Password changed",
          message: "Your password was changed and all sessions were signed out.",
        }),
      );
    } catch (error) {
      console.error("[auth] password change notice failed", error instanceof Error ? error.message : error);
    }
  });

  return ok({ changed: true, signedOut: true });
});
