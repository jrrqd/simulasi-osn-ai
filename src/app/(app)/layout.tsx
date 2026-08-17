import { eq } from "drizzle-orm";
import { AdminAssistant } from "@/components/admin-assistant";
import { AppSectionSubnav } from "@/components/section-subnav";
import { SiteHeader } from "@/components/site-header";
import { OnboardingGate } from "@/components/onboarding";
import { ProfilePrompt } from "@/components/profile-prompt";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  let needsOnboarding = false;
  let showProfilePrompt = false;
  let isAdmin = session?.user?.role === "admin";

  if (session?.user) {
    const db = await getDb();
    const row = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
    });
    const role = row?.role ?? session.user.role;
    isAdmin = role === "admin";
    if (role === "student") {
      needsOnboarding = !row?.onboardingCompletedAt;
      showProfilePrompt = Boolean(row?.onboardingCompletedAt);
    }
  }

  return (
    <div>
      <SiteHeader
        userName={session?.user?.name}
        userRole={session?.user?.role}
      />
      <OnboardingGate needsOnboarding={needsOnboarding} />
      <AppSectionSubnav />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <ProfilePrompt enabled={showProfilePrompt} />
      {isAdmin ? <AdminAssistant /> : null}
    </div>
  );
}
