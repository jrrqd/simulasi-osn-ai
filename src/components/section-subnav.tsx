"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SectionSubnavLink = {
  href: string;
  label: string;
  /** Exact match only (default: href is prefix, except bare section root). */
  exact?: boolean;
};

/**
 * Student secondary nav under SiteHeader — same structure as admin bar,
 * brand-accent tone (not dark admin console).
 * Full viewport width (breaks out of main.max-w-6xl).
 */
export function SectionSubnav({
  title,
  links,
  hidden,
}: {
  title: string;
  links: SectionSubnavLink[];
  /** Hide entirely (e.g. active timed mock). */
  hidden?: boolean;
}) {
  const pathname = usePathname();
  if (hidden) return null;

  function isActive(link: SectionSubnavLink) {
    if (link.exact || link.href === "/practice" || link.href === "/mock") {
      // Section home: active for bank root and detail pages under it,
      // but not for sibling tabs like /practice/generate.
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
      return pathname === link.href;
    }
    return (
      pathname === link.href || pathname.startsWith(`${link.href}/`)
    );
  }

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] mb-6 w-screen -mt-8 border-b border-[var(--line)] bg-[var(--accent)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1.5 px-4 py-1.5">
        <span className="mr-1.5 text-sm font-semibold tracking-wide text-white">
          {title}
        </span>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map((link) => {
            const active = isActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  active
                    ? "bg-white font-medium text-[var(--ink)]"
                    : "text-white/85 hover:bg-white/15 hover:text-white"
                }`}
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
