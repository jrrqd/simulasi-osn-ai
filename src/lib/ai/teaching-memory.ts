import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { assistantLearningRecords, topicMastery, user } from "@/db/schema";
import { rankGaps } from "@/lib/analytics/mastery";
import {
  isLearningRecordStatus,
  parseLearningRecordMarker,
  type LearningRecordStatus,
} from "@/lib/ai/learning-record-marker";
import { TOPIC_LABELS } from "@/lib/content/types";
import { PHASE_LABELS, parsePhase } from "@/lib/user/phase";

export type LearningRecordSource = "study" | "practice";

export {
  parseLearningRecordMarker,
  stripLearningRecordMarkers,
  isLearningRecordStatus,
  LEARNING_RECORD_STATUSES,
  type LearningRecordStatus,
  type ParsedLearningRecord,
} from "@/lib/ai/learning-record-marker";

const STATUS_LABEL: Record<LearningRecordStatus, string> = {
  understood: "sudah paham",
  struggling: "masih bingung",
  corrected_misconception: "misconception dikoreksi",
};

export async function appendLearningRecord(input: {
  userId: string;
  source: LearningRecordSource;
  status: LearningRecordStatus;
  note: string;
  topic?: string | null;
  lessonId?: string | null;
  problemId?: string | null;
}): Promise<void> {
  const db = await getDb();
  await db.insert(assistantLearningRecords).values({
    id: nanoid(),
    userId: input.userId,
    source: input.source,
    status: input.status,
    note: input.note.slice(0, 200),
    topic: input.topic?.slice(0, 80) || null,
    lessonId: input.lessonId || null,
    problemId: input.problemId || null,
    createdAt: new Date(),
  });
}

/**
 * Soft mission + recent learning records for Study/Practice system prompts.
 */
export async function loadTeachingMemoryContext(
  userId: string,
  opts: {
    lessonId?: string;
    problemId?: string;
    topicHint?: string;
  } = {},
): Promise<string> {
  const db = await getDb();
  const [profile, masteryRows, records] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, userId) }),
    db.select().from(topicMastery).where(eq(topicMastery.userId, userId)),
    db
      .select()
      .from(assistantLearningRecords)
      .where(eq(assistantLearningRecords.userId, userId))
      .orderBy(desc(assistantLearningRecords.createdAt))
      .limit(8),
  ]);

  const phase = parsePhase(profile?.phase);
  const gaps = rankGaps(
    masteryRows.map((m) => ({
      topic: m.topic,
      track: m.track,
      mastery: m.mastery,
      attemptsCount: m.attemptsCount,
    })),
  ).slice(0, 4);

  const focusParts = [
    opts.lessonId ? `modul ${opts.lessonId}` : null,
    opts.problemId ? `soal ${opts.problemId}` : null,
    opts.topicHint
      ? `topik ${TOPIC_LABELS[opts.topicHint] ?? opts.topicHint}`
      : null,
  ].filter(Boolean);

  const lines: string[] = [
    "## Memori belajar siswa (lanjutkan dari sini; jangan ulangi yang sudah paham tanpa perlu)",
    `Misi / tahap kompetisi: ${PHASE_LABELS[phase]} (${phase}).`,
  ];

  if (focusParts.length) {
    lines.push(`Fokus sesi ini: ${focusParts.join(" · ")}.`);
  }

  if (gaps.length) {
    lines.push(
      "Gap mastery (lemah → prioritas):",
      ...gaps.map(
        (g) =>
          `- ${TOPIC_LABELS[g.topic] ?? g.topic}: ${Math.round(g.mastery * 100)}% (${g.attemptsCount} attempt)`,
      ),
    );
  } else {
    lines.push("Belum ada data mastery topik yang cukup.");
  }

  if (records.length) {
    lines.push("Catatan belajar terkini (baru → lama):");
    for (const r of records) {
      const label = isLearningRecordStatus(r.status)
        ? STATUS_LABEL[r.status]
        : r.status;
      const topicBit = r.topic
        ? TOPIC_LABELS[r.topic] ?? r.topic
        : "umum";
      lines.push(`- [${label}] ${topicBit}: ${r.note}`);
    }
  } else {
    lines.push(
      "Belum ada learning record. Infer level dari pertanyaan siswa; jangan asumsikan pengetahuan lanjutan.",
    );
  }

  return lines.join("\n");
}

/** Parse marker from full assistant text and persist if valid. */
export async function persistLearningRecordFromAssistantText(input: {
  userId: string;
  source: LearningRecordSource;
  text: string;
  lessonId?: string;
  problemId?: string;
  topicFallback?: string;
}): Promise<boolean> {
  const parsed = parseLearningRecordMarker(input.text);
  if (!parsed) return false;
  await appendLearningRecord({
    userId: input.userId,
    source: input.source,
    status: parsed.status,
    note: parsed.note,
    topic: parsed.topic ?? input.topicFallback ?? null,
    lessonId: input.lessonId,
    problemId: input.problemId,
  });
  return true;
}
