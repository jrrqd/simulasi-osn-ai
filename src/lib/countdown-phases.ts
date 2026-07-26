import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { countdownPhases } from "@/db/schema";
import {
  SELEKSI_PHASES,
  type SeleksiPhase,
} from "@/lib/seleksi-phases";

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
