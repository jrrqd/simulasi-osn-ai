"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const links = [
  { href: "/study", label: "Belajar" },
  { href: "/practice", label: "Latihan" },
  { href: "/mock", label: "Simulasi" },
  { href: "/performance", label: "Performa" },
  { href: "/settings", label: "Pengaturan" },
];

export function SiteHeader({
  userName,
  userRole,
}: {
  userName?: string | null;
  userRole?: string | null;
}) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(243,239,230,0.85)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
            <BrainCircuit size={18} />
          </span>
          <span className="display text-lg">Simulasi OSN AI</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-white/70 hover:text-[var(--ink)]"
            >
              {l.label}
            </Link>
          ))}
          {userRole === "admin" && (
            <Link
              href="/admin"
              className="rounded-full bg-[var(--accent-2)] px-3 py-1.5 text-sm text-white"
            >
              Admin
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          {userName ? (
            <>
              <span className="hidden text-[var(--muted)] sm:inline">{userName}</span>
              <button
                type="button"
                onClick={signOut}
                className="btn btn-secondary !px-3 !py-1.5 text-sm"
              >
                Keluar
              </button>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary !px-3 !py-1.5 text-sm">
              Masuk
            </Link>
          )}
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-full bg-white/60 px-3 py-1 text-xs text-[var(--muted)]"
          >
            {l.label}
          </Link>
        ))}
        {userRole === "admin" && (
          <Link
            href="/admin"
            className="whitespace-nowrap rounded-full bg-[var(--accent-2)] px-3 py-1 text-xs text-white"
          >
            Admin
          </Link>
        )}
      </div>
    </header>
  );
}
