import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { countdownPhases } from "@/db/schema";

export type SeleksiPhase = {
  id: string;
  label: string;
  dateLabel: string;
  /** Start of this milestone (WIB). Countdown targets this until it passes. */
  at: string;
  /** Optional exclusive end (WIB). Used for multi-day final window. */
  endsAt?: string;
};

/** EKKA / OSN AI 2026 official-style milestones (WIB). Used as landing fallback. */
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

    if (phase.endsAt && nowMs < end) {
      return { kind: "live", phase };
    }

    if (!phase.endsAt) {
      continue;
    }
  }

  const last = phases[phases.length - 1]!;
  return { kind: "done", phase: last };
}

export type CountdownPhaseRow = {
  id: string;
  label: string;
  dateLabel: string;
  at: string;
  endsAt: string | null;
  sortOrder: number;
  enabled: boolean;
  updatedAt: Date;
  createdAt: Date;
};

export function rowToSeleksiPhase(row: {
  id: string;
  label: string;
  dateLabel: string;
  at: string;
  endsAt: string | null;
}): SeleksiPhase {
  return {
    id: row.id,
    label: row.label,
    dateLabel: row.dateLabel,
    at: row.at,
    ...(row.endsAt ? { endsAt: row.endsAt } : {}),
  };
}

/**
 * Enabled phases for the landing countdown.
 * Falls back to built-in defaults only when the table has no rows yet.
 */
export async function listPublicCountdownPhases(): Promise<SeleksiPhase[]> {
  const db = await getDb();
  const all = await db
    .select()
    .from(countdownPhases)
    .orderBy(asc(countdownPhases.sortOrder), asc(countdownPhases.at));

  if (all.length === 0) return SELEKSI_PHASES;
  return all.filter((row) => row.enabled).map(rowToSeleksiPhase);
}

export async function listAdminCountdownPhases(): Promise<CountdownPhaseRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(countdownPhases)
    .orderBy(asc(countdownPhases.sortOrder), asc(countdownPhases.at));
}

export function isValidIsoInstant(value: string): boolean {
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

export function slugifyPhaseId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
