import "server-only";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { ApiError, clientIpFromHeaders } from "@/lib/api";
import { authConfig, getGoogleConfig } from "@/lib/config";
import { verifyChallenge } from "@/lib/auth/challenges";
import { completeLogin, completeSignup, isAccountSuspended, upsertGoogleUser } from "@/lib/auth/accounts";
import { enforceRateLimits } from "@/lib/rate-limit";
import { otpVerifySchema } from "@/lib/validation";
import dbConnect from "@/lib/db";
import User from "@/models/User";

const google = getGoogleConfig();

/**
 * Single session system for the app: NextAuth JWT sessions (encrypted,
 * HttpOnly, SameSite=Lax, Secure on HTTPS).
 *
 * Email/password accounts can only obtain a session through the "otp"
 * provider, which requires a code delivered by email after the password (or
 * the signup form) was checked by /api/auth/login or /api/auth/signup. A
 * password alone never creates a session.
 */
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: authConfig.sessionMaxAgeDays() * 24 * 60 * 60,
    updateAge: 12 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      id: "otp",
      name: "Email verification code",
      credentials: {
        challengeToken: { label: "Verification session", type: "text" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials, req) {
        const parsed = otpVerifySchema.safeParse(credentials ?? {});
        if (!parsed.success) throw new Error("CODE_INVALID");
        try {
          const ip = clientIpFromHeaders(req?.headers as Record<string, string> | undefined);
          await enforceRateLimits([{ key: `otp-verify:ip:${ip}`, limit: 30, windowSeconds: 900 }]);
          const challenge = await verifyChallenge(parsed.data.challengeToken, parsed.data.code, ["signup", "login"]);
          return challenge.purpose === "signup" ? await completeSignup(challenge) : await completeLogin(challenge);
        } catch (error) {
          if (error instanceof ApiError) {
            const remaining = error.details?.attemptsRemaining;
            throw new Error(typeof remaining === "number" ? `${error.code}:${remaining}` : error.code);
          }
          console.error("[auth] otp sign-in failed", error);
          throw new Error("SERVER_ERROR");
        }
      },
    }),
    ...(google ? [GoogleProvider({ clientId: google.clientId, clientSecret: google.clientSecret })] : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      const googleProfile = profile as { email?: string; email_verified?: boolean; sub?: string } | undefined;
      if (!googleProfile?.email || googleProfile.email_verified !== true) return "/login?error=GOOGLE_EMAIL_UNVERIFIED";
      if (await isAccountSuspended(googleProfile.email, googleProfile.sub)) return "/login?error=ACCOUNT_UNAVAILABLE";
      return true;
    },
    async jwt({ token, user, account, profile, trigger }) {
      if (account?.provider === "google" && profile) {
        const p = profile as { sub?: string; email?: string; name?: string; picture?: string };
        if (!p.sub || !p.email) throw new Error("GOOGLE_PROFILE_INVALID");
        const dbUser = await upsertGoogleUser({ sub: p.sub, email: p.email, name: p.name, picture: p.picture });
        token.uid = dbUser.id;
        token.sv = dbUser.sv;
        token.name = dbUser.name;
        token.email = dbUser.email;
        token.picture = dbUser.image ?? null;
        return token;
      }
      if (user) {
        const sessionUser = user as typeof user & { sv?: number };
        token.uid = sessionUser.id;
        token.sv = sessionUser.sv ?? 0;
        token.name = sessionUser.name;
        token.email = sessionUser.email;
        token.picture = sessionUser.image ?? null;
      }
      // Profile edits refresh display fields from the database (never from client input).
      if (trigger === "update" && token.uid) {
        await dbConnect();
        const fresh = await User.findById(token.uid).select("name email image").lean();
        if (fresh) {
          token.name = fresh.name;
          token.email = fresh.email;
          token.picture = fresh.image ?? null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.uid ?? "",
        name: token.name ?? null,
        email: token.email ?? null,
        image: (token.picture as string | null | undefined) ?? null,
      };
      session.sv = token.sv ?? 0;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
};

export const isGoogleAuthEnabled = () => getGoogleConfig() !== null;
