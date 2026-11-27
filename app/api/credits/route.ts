import { apiRoute, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { REFINE_ACTIONS } from "@/lib/templates/options";

/** Current balance plus the price list the UI shows. Read-only: balances change only server-side. */
export const GET = apiRoute(async (req) => {
  const user = await requireUser(req);
  return ok({
    balance: user.availableCredits ?? 0,
    totalEarned: user.totalCreditsEarned ?? 0,
    totalUsed: user.totalCreditsUsed ?? 0,
    costs: {
      generation: [
        { label: "Short-form & lists (captions, titles, taglines, bios)", credits: 1 },
        { label: "Medium-form (emails, ads, product descriptions)", credits: 2 },
        { label: "Long-form (blog posts, articles, scripts)", credits: 3 },
        { label: "Long-form at “Long” length", credits: 4 },
      ],
      editor: REFINE_ACTIONS.map((a) => ({ label: a.label, credits: a.cost })),
    },
  });
});
