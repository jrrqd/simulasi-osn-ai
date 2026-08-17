"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type SectionSubnavLink = {
  href: string;
  label: string;
  /** Exact match only (default: href is prefix, except section homes). */
  exact?: boolean;
};

const PRACTICE_LINKS: SectionSubnavLink[] = [
  { href: "/practice", label: "Bank soal" },
  { href: "/practice/generate", label: "Generate" },
  { href: "/practice/ioai", label: "Arsip IOAI" },
];

const MOCK_LINKS: SectionSubnavLink[] = [
  { href: "/mock", label: "Bank paket" },
  { href: "/mock/generate", label: "Generate" },
];

/**
 * Student/admin secondary nav under SiteHeader — full viewport width,
 * sibling of main (same structure as the admin console bar).
 */
export function SectionSubnav({
  title,
  links,
  hidden,
  variant = "student",
  icon,
}: {
  title: string;
  links: SectionSubnavLink[];
  hidden?: boolean;
  variant?: "student" | "admin";
  icon?: ReactNode;
}) {
  const pathnameFromHook = usePathname() ?? "";
  const [pathname, setPathname] = useState("");

  useEffect(() => {
    setPathname(pathnameFromHook);
  }, [pathnameFromHook]);

  if (hidden) return null;

  function isActive(link: SectionSubnavLink) {
    if (link.href === "/practice") {
      return (
        pathname === "/practice" ||
        (pathname.startsWith("/practice/") &&
          !pathname.startsWith("/practice/generate") &&
          !pathname.startsWith("/practice/ioai"))
      );
    }
    if (link.href === "/mock") {
      return (
        pathname === "/mock" ||
        (pathname.startsWith("/mock/") &&
          !pathname.startsWith("/mock/generate"))
      );
    }
    if (link.exact) {
      return pathname === link.href;
    }
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  }

  const bar =
    variant === "admin"
      ? "border-b border-[var(--line)] bg-[#173d34] text-white"
      : "border-b border-[var(--line)] bg-[var(--accent)] text-white";

  return (
    <div className={bar}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <span className="mr-3 flex items-center gap-2 font-semibold">
          {icon}
          {title}
        </span>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map((link) => {
            const active = isActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-white text-white"
                    : "border-transparent text-white/80 hover:border-white/30 hover:text-white"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function AppSectionSubnav() {
  const pathnameFromHook = usePathname() ?? "";
  const [pathname, setPathname] = useState("");

  useEffect(() => {
    setPathname(pathnameFromHook);
  }, [pathnameFromHook]);

  if (pathname.startsWith("/practice")) {
    return <SectionSubnav title="Latihan" links={PRACTICE_LINKS} />;
  }

  if (pathname.startsWith("/mock")) {
    const onExam =
      pathname.startsWith("/mock/") && !pathname.startsWith("/mock/generate");
    return (
      <SectionSubnav title="Simulasi" links={MOCK_LINKS} hidden={onExam} />
    );
  }

  return null;
}
