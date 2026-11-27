import "server-only";
import { isAIConfigured } from "@/lib/ai";
import { isEmailConfigured } from "@/lib/email/mailer";
import { getPaymentProvider } from "@/lib/payments";

/** Which external integrations are configured (booleans only, never secrets). */
export function getFeatureFlags() {
  return {
    ai: isAIConfigured(),
    payments: getPaymentProvider() !== null,
    email: isEmailConfigured(),
  };
}

export type FeatureFlags = ReturnType<typeof getFeatureFlags>;
