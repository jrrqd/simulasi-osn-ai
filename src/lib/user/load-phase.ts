import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { getPhase, type Phase } from "@/lib/user/phase";

export type UserPhaseAccess = {
  phase: Phase;
  role: string | null;
};

/** Load the user's selected prep phase from the DB (defaults to pre-seleksi). */
export async function loadUserPhase(userId: string): Promise<Phase> {
  const access = await loadUserPhaseAccess(userId);
  return access.phase;
}

export async function loadUserPhaseAccess(
  userId: string,
): Promise<UserPhaseAccess> {
  const db = await getDb();
  const row = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { phase: true, role: true },
  });
  return {
    phase: getPhase(row),
    role: row?.role ?? null,
  };
}

export function canAccessIoaiResources(
  phase: Phase,
  role?: string | null,
): boolean {
  if (role === "admin") return true;
  return phase === "semifinal" || phase === "final";
}
