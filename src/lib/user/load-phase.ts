import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { getPhase, type Phase } from "@/lib/user/phase";

/** Server-only helper — never import from client components. */
export async function loadUserPhase(userId: string): Promise<Phase> {
  const db = await getDb();
  const row = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { phase: true, role: true },
  });
  return getPhase(row);
}

export function canAccessIoaiResources(
  phase: Phase,
  role?: string | null,
): boolean {
  if (role === "admin") return true;
  return phase === "semifinal" || phase === "final";
}
