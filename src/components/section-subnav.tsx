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
    <div className="-mx-4 -mt-8 mb-8 border-b border-[var(--line)] bg-[var(--accent)] text-white">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="mr-2 text-sm font-semibold tracking-wide">
          {title}
        </span>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map((link) => {
            const active = isActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-white font-medium text-[var(--accent)]"
                    : "text-white/80 hover:bg-white/15 hover:text-white"
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
