export const PHASE_VALUES = ["pre-seleksi", "semifinal", "final"] as const;

export type Phase = (typeof PHASE_VALUES)[number];

export const PHASE_LABELS: Record<Phase, string> = {
  "pre-seleksi": "Pre-seleksi",
  semifinal: "Semifinal",
  final: "Final",
};

export const PHASE_HINTS: Record<Phase, string> = {
  "pre-seleksi": "Fokus fondasi A–D sesuai silabus seleksi awal.",
  semifinal:
    "Mock disetel untuk tahap semifinal — lebih banyak topik lanjutan (SVM, ensemble, CNN/RNN, transformer).",
  final:
    "Mock disetel untuk tahap final — bias ke topik IOAI-adjacent (transformer, CNN, aljabar lanjut).",
};

/** Topics introduced for semifinal / IOAI-adjacent prep. */
export const SEMIFINAL_TOPICS = [
  "aljabar-linier-lanjut",
  "optimasi-lanjut",
  "pohon-keputusan",
  "ensemble",
  "svm",
  "cnn-arsitektur",
  "rnn-lstm",
  "deteksi-segmentasi",
  "transformer-lanjut",
] as const;

export type SemifinalTopic = (typeof SEMIFINAL_TOPICS)[number];

export function isPhase(value: unknown): value is Phase {
  return (
    typeof value === "string" &&
    (PHASE_VALUES as readonly string[]).includes(value)
  );
}

export function parsePhase(value: unknown): Phase {
  return isPhase(value) ? value : "pre-seleksi";
}

export function getPhase(user: { phase?: string | null } | null | undefined): Phase {
  return parsePhase(user?.phase);
}

/** Load the user's selected prep phase from the DB (defaults to pre-seleksi). */
export async function loadUserPhase(userId: string): Promise<Phase> {
  const { getDb } = await import("@/db");
  const { user } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  const row = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { phase: true },
  });
  return getPhase(row);
}
