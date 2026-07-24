"use client";

import { useState, type ReactNode } from "react";

export function CollapsiblePanel({
  title,
  summary,
  accent = "primary",
  defaultOpen = false,
  children,
}: {
  title: string;
  summary: string;
  accent?: "primary" | "accent";
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="panel overflow-hidden rounded-2xl">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-black/[0.03]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span
          className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            accent === "accent"
              ? "bg-[var(--accent-2)] text-[#fff8f2]"
              : "bg-[var(--accent)] text-[#f7fff9]"
          }`}
        >
          {open ? "−" : "+"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="display block text-lg leading-tight">{title}</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            {summary}
          </span>
        </span>
        <span className="shrink-0 pt-1 text-xs font-medium text-[var(--muted)]">
          {open ? "Tutup" : "Buka"}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-[var(--line)] px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}
