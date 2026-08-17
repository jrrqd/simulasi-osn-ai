import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function chipClass(active: boolean) {
  return `rounded-full px-3 py-1 text-sm transition ${
    active
      ? "bg-[var(--accent)] text-white"
      : "bg-white/70 text-[var(--ink)] hover:bg-white"
  }`;
}

export function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={chipClass(active)}>
      {children}
    </Link>
  );
}

export function ChoiceChip({
  active,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type={type}
      className={`${chipClass(active)} disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
