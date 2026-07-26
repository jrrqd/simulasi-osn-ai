"use client";

import { useEffect, useMemo, useState } from "react";

export type SeleksiPhase = {
  id: string;
  label: string;
  dateLabel: string;
  /** Start of this milestone (WIB). Countdown targets this until it passes. */
  at: string;
  /** Optional exclusive end (WIB). Used for multi-day final window. */
  endsAt?: string;
};

/** EKKA / OSN AI 2026 official-style milestones (WIB). */
export const SELEKSI_PHASES: SeleksiPhase[] = [
  {
    id: "pra-seleksi",
    label: "Pra-seleksi",
    dateLabel: "30 Juli 2026",
    at: "2026-07-30T00:00:00+07:00",
  },
  {
    id: "pengumuman-tahap-i",
    label: "Pengumuman tahap I",
    dateLabel: "3 Agustus 2026",
    at: "2026-08-03T00:00:00+07:00",
  },
  {
    id: "seleksi-semi",
    label: "Seleksi / semi final",
    dateLabel: "12 Agustus 2026",
    at: "2026-08-12T00:00:00+07:00",
  },
  {
    id: "finalis-30",
    label: "Pengumuman finalis 30 besar",
    dateLabel: "18 Agustus 2026",
    at: "2026-08-18T00:00:00+07:00",
  },
  {
    id: "final-nasional",
    label: "Final nasional",
    dateLabel: "14–20 September 2026",
    at: "2026-09-14T00:00:00+07:00",
    endsAt: "2026-09-21T00:00:00+07:00",
  },
];

/** @deprecated Prefer SELEKSI_PHASES; kept for any old imports. */
export const SELEKSI_AT = SELEKSI_PHASES[0]!.at;

export type ActivePhaseState =
  | {
      kind: "countdown";
      phase: SeleksiPhase;
      targetMs: number;
    }
  | {
      kind: "live";
      phase: SeleksiPhase;
    }
  | {
      kind: "done";
      phase: SeleksiPhase;
    };

export function resolveSeleksiPhase(
  nowMs: number,
  phases: SeleksiPhase[] = SELEKSI_PHASES,
): ActivePhaseState {
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i]!;
    const start = new Date(phase.at).getTime();
    const end = phase.endsAt
      ? new Date(phase.endsAt).getTime()
      : start + 24 * 60 * 60 * 1000;

    if (nowMs < start) {
      return { kind: "countdown", phase, targetMs: start };
    }

    // Multi-day window (final): show live until endsAt
    if (phase.endsAt && nowMs < end) {
      return { kind: "live", phase };
    }

    // Single-day milestone: once started, advance to next phase countdown
    if (!phase.endsAt) {
      continue;
    }
  }

  const last = phases[phases.length - 1]!;
  return { kind: "done", phase: last };
}

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

export function EventCountdown() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const state = useMemo(() => resolveSeleksiPhase(now), [now]);

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
