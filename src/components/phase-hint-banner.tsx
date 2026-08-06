"use client";

import { useEffect, useState } from "react";
import {
  PHASE_HINTS,
  PHASE_LABELS,
  parsePhase,
  type Phase,
} from "@/lib/user/phase";

export function PhaseHintBanner() {
  const [phase, setPhase] = useState<Phase | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setPhase(parsePhase(data.phase));
      })
      .catch(() => {
        /* ignore — hint is optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!phase || phase === "pre-seleksi") return null;

  return (
    <p className="rounded-2xl bg-[var(--accent)]/10 px-3 py-2 text-xs text-[var(--accent)]">
      Mode: {PHASE_LABELS[phase]} OSN AI 2026 — {PHASE_HINTS[phase]}
    </p>
  );
}
