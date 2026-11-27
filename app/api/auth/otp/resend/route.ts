import { apiRoute, getClientIp, ok, readJson } from "@/lib/api";
import { resendChallenge } from "@/lib/auth/challenges";
import { enforceRateLimits } from "@/lib/rate-limit";
import { resendSchema } from "@/lib/validation";

/** Sends a fresh code for an open verification session (60s cooldown, limited sends). */
export const POST = apiRoute(async (req) => {
  const { challengeToken } = await readJson(req, resendSchema);
  await enforceRateLimits([{ key: `otp-resend:ip:${getClientIp(req)}`, limit: 20, windowSeconds: 3600 }]);
  return ok(await resendChallenge(challengeToken));
});
