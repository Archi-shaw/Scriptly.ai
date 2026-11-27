import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getCurrentUser, serializeUser, userHasPassword } from "@/lib/auth/session";
import { getFeatureFlags } from "@/lib/features";
import AppShell from "@/app/components/app/AppShell";
import SessionRevoked from "@/app/components/app/SessionRevoked";

export const dynamic = "force-dynamic";

/** Server-side gate for the workspace: the session must map to an active user with a current session version. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    const session = await getServerSession(authOptions);
    if (session) return <SessionRevoked />;
    redirect("/login");
  }

  const initialMe = {
    user: serializeUser(user, { hasPassword: await userHasPassword(user._id) }),
    features: getFeatureFlags(),
  };
  return <AppShell initialMe={initialMe}>{children}</AppShell>;
}
