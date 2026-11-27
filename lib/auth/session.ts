import "server-only";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { cache } from "react";
import dbConnect from "@/lib/db";
import { ApiError } from "@/lib/api";
import { getAuthSecret } from "@/lib/config";
import { authOptions } from "@/lib/auth/options";
import User, { type UserDoc } from "@/models/User";

export type CurrentUser = UserDoc;

function isSessionValid(user: Pick<UserDoc, "status" | "sessionVersion"> | null, sv: number | undefined): boolean {
  return !!user && user.status === "active" && (user.sessionVersion ?? 0) === (sv ?? 0);
}

/**
 * Authenticates an API request: validates the session JWT, then confirms the
 * user still exists, is active and the session has not been revoked.
 */
export async function requireUser(req: NextRequest): Promise<CurrentUser> {
  const token = await getToken({ req, secret: getAuthSecret() });
  if (!token?.uid) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  await dbConnect();
  const user = await User.findById(token.uid).lean();
  if (!isSessionValid(user, token.sv)) {
    throw new ApiError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");
  }
  return user as CurrentUser;
}

/** For server components/layouts. Returns null when there is no valid session. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  await dbConnect();
  const user = await User.findById(session.user.id).lean();
  return isSessionValid(user, session.sv) ? (user as CurrentUser) : null;
});

/** Whether the account can sign in with a password (the hash itself never leaves the server). */
export async function userHasPassword(userId: CurrentUser["_id"]): Promise<boolean> {
  await dbConnect();
  return (await User.exists({ _id: userId, passwordHash: { $exists: true, $nin: [null, ""] } })) !== null;
}

/** Shape of the current user exposed to the browser. */
export function serializeUser(user: CurrentUser, options: { hasPassword: boolean }) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    emailVerified: Boolean(user.emailVerified),
    hasPassword: options.hasPassword,
    googleLinked: Boolean(user.googleId),
    credits: user.availableCredits ?? 0,
    totalCreditsEarned: user.totalCreditsEarned ?? 0,
    totalCreditsUsed: user.totalCreditsUsed ?? 0,
    role: user.role,
    createdAt: new Date(user.createdAt).toISOString(),
  };
}

export type SerializedUser = ReturnType<typeof serializeUser>;
