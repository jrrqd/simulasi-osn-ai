"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SELEKSI_PHASES,
  resolveSeleksiPhase,
  type SeleksiPhase,
} from "@/lib/countdown-phases";

export type {
  ActivePhaseState,
  SeleksiPhase,
} from "@/lib/countdown-phases";
export {
  SELEKSI_AT,
  SELEKSI_PHASES,
  resolveSeleksiPhase,
} from "@/lib/countdown-phases";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds };
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="countdown-unit">
      <span className="countdown-value">
        {String(value).padStart(2, "0")}
      </span>
      <span className="countdown-label">{label}</span>
    </div>
  );
}

export function EventCountdown({
  phases = SELEKSI_PHASES,
}: {
  phases?: SeleksiPhase[];
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const state = useMemo(() => {
    if (phases.length === 0) {
      return {
        kind: "done" as const,
        phase: {
          id: "none",
          label: "Seleksi",
          dateLabel: "",
          at: new Date(0).toISOString(),
        },
      };
    }
    return resolveSeleksiPhase(now, phases);
  }, [now, phases]);

  if (state.kind === "live") {
    return (
      <div className="countdown-banner rise rise-delay-1">
        <p className="countdown-kicker">{state.phase.label}</p>
        <p className="display text-xl leading-tight text-[var(--accent)] md:text-2xl">
          {state.phase.dateLabel} · sedang berlangsung
        </p>
      </div>
    );
  }

  if (state.kind === "done") {
    return (
      <div className="countdown-banner">
        <p className="countdown-kicker">{state.phase.label}</p>
        <p className="display text-2xl text-[var(--accent)] md:text-3xl">
          Rangkaian seleksi 2026 telah selesai
        </p>
      </div>
    );
  }

  const { days, hours, minutes, seconds } = parts(state.targetMs - now);

  return (
    <div className="countdown-banner rise rise-delay-1">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="countdown-kicker">{state.phase.label}</p>
          <p className="display text-xl leading-tight md:text-2xl">
            {state.phase.dateLabel}
          </p>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Hitung mundur menuju fase ini
        </p>
      </div>
      <div className="countdown-grid" aria-live="polite">
        <Unit value={days} label="Hari" />
        <Unit value={hours} label="Jam" />
        <Unit value={minutes} label="Menit" />
        <Unit value={seconds} label="Detik" />
      </div>
    </div>
  );
}
