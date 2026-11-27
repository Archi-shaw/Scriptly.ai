import { apiRoute, ok } from "@/lib/api";
import { getSignupBonusCredits } from "@/lib/config";
import { listActivePackages } from "@/lib/packages";
import { getPaymentProvider } from "@/lib/payments";

/** Public credit packages (used by the landing page pricing and the billing page). */
export const GET = apiRoute(async () => {
  const packages = await listActivePackages();
  return ok(
    { packages, signupBonus: getSignupBonusCredits(), paymentsEnabled: getPaymentProvider() !== null },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
});
