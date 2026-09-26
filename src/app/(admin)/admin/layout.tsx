import { ShieldCheck } from "lucide-react";
import { AdminAssistant } from "@/components/admin-assistant";
import { SectionSubnav } from "@/components/section-subnav";
import { SiteHeader } from "@/components/site-header";
import { userCanUseAiAssistant } from "@/components/feature-gate";
import { requireAdmin } from "@/lib/session";

const adminLinks = [
  { href: "/admin", label: "Ringkasan", exact: true },
  { href: "/admin/users", label: "Pengguna" },
  { href: "/admin/access", label: "Akses" },
  { href: "/admin/lessons", label: "Modul belajar" },
  { href: "/admin/resources", label: "Referensi IOAI" },
  { href: "/admin/problems", label: "Bank soal" },
  { href: "/admin/mocks", label: "Bank simulasi" },
  { href: "/admin/countdown", label: "Countdown" },
  { href: "/admin/news", label: "Berita" },
  { href: "/admin/ai", label: "LLM Bersama" },
];

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const showAssistant = await userCanUseAiAssistant(admin.id);
  return (
    <div>
      <SiteHeader userName={admin.name} userRole={admin.role} />
      <SectionSubnav
        variant="admin"
        title="Admin Console"
        icon={<ShieldCheck size={18} />}
        links={adminLinks}
      />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      {showAssistant ? <AdminAssistant /> : null}
    </div>
  );
}
