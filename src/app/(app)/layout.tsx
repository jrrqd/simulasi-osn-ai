import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <div>
      <SiteHeader
        userName={session?.user?.name}
        userRole={session?.user?.role}
      />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
