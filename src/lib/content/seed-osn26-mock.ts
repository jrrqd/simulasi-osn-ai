import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { generatedMocks, user } from "@/db/schema";

export const OSN26_MOCK_ID = "mock-osn26-prediksi";

const OSN26_PROBLEM_IDS = Array.from(
  { length: 34 },
  (_, i) => `p-osn26-q${String(i + 1).padStart(2, "0")}`,
);

type SeedDb = Awaited<ReturnType<typeof getDb>>;

/**
 * Move the former curated Bank Soal EKKA mock into generated_mocks so it
 * appears under Simulasi AI bersama and is fully editable in admin.
 * Idempotent: insert only if the row is missing (permanent deletes stick).
 */
export async function ensureOsn26MockInDb(db?: SeedDb): Promise<boolean> {
  const database = db ?? (await getDb());

  const existing = await database.query.generatedMocks.findFirst({
    where: eq(generatedMocks.id, OSN26_MOCK_ID),
    columns: { id: true },
  });
  if (existing) return false;

  const owner =
    (await database.query.user.findFirst({
      where: eq(user.role, "admin"),
      columns: { id: true },
    })) ??
    (await database.query.user.findFirst({
      columns: { id: true },
    }));

  if (!owner) return false;

  await database.insert(generatedMocks).values({
    id: OSN26_MOCK_ID,
    createdBy: owner.id,
    title: "Simulasi OSN AI (EKKA) 2026",
    description:
      "34 soal resmi bergaya studi kasus lintas silabus, dibersihkan untuk simulasi timed 150 menit.",
    durationMinutes: 150,
    difficultyMode: "normal",
    problemIds: OSN26_PROBLEM_IDS,
    track: "ALL",
    kind: "ai",
    penaltyEnabled: true,
    penaltyMinutesPerWrong: 1,
  });

  return true;
}
