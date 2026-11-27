import "server-only";
import dbConnect, { isDuplicateKeyError, withOptionalTransaction } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { getSignupBonusCredits } from "@/lib/config";
import { applyCreditChange } from "@/lib/credits";
import { challengeNotFound } from "@/lib/auth/challenges";
import User, { type UserDoc } from "@/models/User";
import type { AuthChallengeDoc } from "@/models/AuthChallenge";

/** The minimal identity stored in the session token. */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  sv: number;
}

function toSessionUser(user: Pick<UserDoc, "_id" | "name" | "email" | "image" | "sessionVersion">): SessionUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    sv: user.sessionVersion ?? 0,
  };
}

/** Creates a verified account and grants the signup bonus atomically (when transactions are available). */
async function createVerifiedUser(data: {
  name: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  image?: string;
}): Promise<UserDoc> {
  const bonus = getSignupBonusCredits();
  try {
    return await withOptionalTransaction(async (session) => {
      const [user] = await User.create(
        [
          {
            name: data.name,
            email: data.email,
            passwordHash: data.passwordHash,
            googleId: data.googleId,
            image: data.image,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            lastLoginAt: new Date(),
          },
        ],
        { session },
      );
      if (bonus > 0) {
        await applyCreditChange(
          {
            userId: user._id,
            amount: bonus,
            type: "bonus",
            description: "Welcome bonus credits",
            idempotencyKey: `signup-bonus:${user._id.toString()}`,
          },
          session,
        );
      }
      return user.toObject() as UserDoc;
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists. Try signing in instead.");
    }
    throw error;
  }
}

/** Stage 2 of signup: the email is proven, so the account is created now. */
export async function completeSignup(challenge: AuthChallengeDoc): Promise<SessionUser> {
  const name = challenge.payload?.name;
  const passwordHash = challenge.payload?.passwordHash;
  if (!name || !passwordHash) throw challengeNotFound();
  await dbConnect();
  const user = await createVerifiedUser({ name, email: challenge.email, passwordHash });
  return toSessionUser(user);
}

/** Stage 2 of login: password was checked in stage 1, the emailed code was just verified. */
export async function completeLogin(challenge: AuthChallengeDoc): Promise<SessionUser> {
  await dbConnect();
  const user = await User.findOneAndUpdate(
    { _id: challenge.userId, status: "active" },
    { $set: { lastLoginAt: new Date() } },
    { new: true },
  ).lean();
  if (!user) throw new ApiError(403, "ACCOUNT_UNAVAILABLE", "This account is not available. Please contact support.");
  return toSessionUser(user);
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string | null;
  picture?: string | null;
}

export async function isAccountSuspended(email: string, googleId?: string): Promise<boolean> {
  await dbConnect();
  const user = await User.findOne({ $or: [{ email: email.toLowerCase() }, ...(googleId ? [{ googleId }] : [])] })
    .select("status")
    .lean();
  return user?.status === "suspended";
}

/**
 * Finds or creates the user for a Google sign-in. Google has verified the
 * email, so an existing account with that email is linked.
 */
export async function upsertGoogleUser(identity: GoogleIdentity): Promise<SessionUser> {
  await dbConnect();
  const email = identity.email.toLowerCase();

  type Found = Pick<UserDoc, "_id" | "name" | "email" | "image" | "sessionVersion" | "status">;
  let user: Found | null = await User.findOne({ googleId: identity.sub }).lean();
  if (!user) {
    user = await User.findOneAndUpdate(
      { email },
      {
        $set: { googleId: identity.sub, emailVerified: true, lastLoginAt: new Date() },
        $min: { emailVerifiedAt: new Date() },
      },
      { new: true },
    ).lean();
  }
  if (!user) {
    const fallbackName = email.split("@")[0] ?? "Scriptly user";
    user = await createVerifiedUser({
      name: (identity.name ?? fallbackName).slice(0, 80),
      email,
      googleId: identity.sub,
      image: identity.picture ?? undefined,
    });
  } else {
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  }

  if (user.status !== "active") {
    throw new ApiError(403, "ACCOUNT_UNAVAILABLE", "This account is not available. Please contact support.");
  }
  return toSessionUser(user);
}
