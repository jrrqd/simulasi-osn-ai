import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { getPhase, type Phase } from "@/lib/user/phase";

/** Load the user's selected prep phase from the DB (defaults to pre-seleksi). */
export async function loadUserPhase(userId: string): Promise<Phase> {
  const db = await getDb();
  const row = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { phase: true },
  });
  return getPhase(row);
}
