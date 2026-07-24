import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { AdminAssistant } from "@/components/admin-assistant";
import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/session";

const adminLinks = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/users", label: "Pengguna" },
  { href: "/admin/ai", label: "LLM Bersama" },
];

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  return (
    <div>
      <SiteHeader userName={admin.name} userRole={admin.role} />
      <div className="border-b border-[var(--line)] bg-[#173d34] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="mr-3 flex items-center gap-2 font-semibold">
            <ShieldCheck size={18} />
            Admin Console
          </span>
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 text-sm text-white/75 hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <AdminAssistant />
    </div>
  );
}
