"use client";

import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

export function GuideSpoiler({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white/50">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-black/[0.03]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
          {open ? <EyeOff size={14} /> : <Eye size={14} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="display block text-xl leading-tight">{title}</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            {open ? "Klik untuk menyembunyikan" : hint}
          </span>
        </span>
        <span className="shrink-0 pt-1 text-xs font-medium text-[var(--muted)]">
          {open ? "Tutup" : "Buka"}
        </span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-[var(--line)] px-4 py-4">
          {children}
        </div>
      ) : (
        <div className="border-t border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          Isi disembunyikan — buka setelah kamu mencoba sendiri.
        </div>
      )}
    </div>
  );
}
