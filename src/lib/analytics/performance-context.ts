import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, mockSessions, topicMastery, user } from "@/db/schema";
import { overallMastery, rankGaps } from "@/lib/analytics/mastery";
import {
  computeOsnReadiness,
  syllabusTopicsFromMastery,
} from "@/lib/analytics/readiness";
import { TOPIC_LABELS, TRACKS } from "@/lib/content/types";

export async function buildPerformanceCounselingContext(userId: string) {
  const db = await getDb();
  const [profile, masteryRows, recentAttempts, userMocks] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, userId) }),
    db.select().from(topicMastery).where(eq(topicMastery.userId, userId)),
    db
      .select()
      .from(attempts)
      .where(eq(attempts.userId, userId))
      .orderBy(desc(attempts.createdAt))
      .limit(40),
    db
      .select()
      .from(mockSessions)
      .where(eq(mockSessions.userId, userId))
      .orderBy(asc(mockSessions.startedAt)),
  ]);

  const allTopics = Object.entries(TRACKS).flatMap(([track, meta]) =>
    meta.topics.map((topic) => {
      const row = masteryRows.find((m) => m.topic === topic);
      return {
        track,
        topic,
        label: TOPIC_LABELS[topic] ?? topic,
        mastery: row?.mastery ?? 0,
        attemptsCount: row?.attemptsCount ?? 0,
      };
    }),
  );

  const submitted = userMocks.filter(
    (m) =>
      m.status === "submitted" &&
      m.score != null &&
      m.maxScore != null &&
      m.maxScore > 0,
  );
  const avgLifetimeScore = submitted.length
    ? submitted.reduce((sum, m) => sum + m.score! / m.maxScore!, 0) /
      submitted.length
    : 0;
  const attemptsCount = allTopics.reduce((sum, t) => sum + t.attemptsCount, 0);
  const readiness = computeOsnReadiness({
    topics: syllabusTopicsFromMastery(
      masteryRows.map((m) => ({
        topic: m.topic,
        mastery: m.mastery,
        attemptsCount: m.attemptsCount,
      })),
    ),
    avgMockScoreRatio: avgLifetimeScore,
    completedMocks: submitted.length,
    attemptsCount,
  });

  const gaps = rankGaps(allTopics)
    .slice(0, 5)
    .map(
      (g) =>
        `- ${TOPIC_LABELS[g.topic] ?? g.topic}: mastery ${Math.round(g.mastery * 100)}% (${g.attemptsCount} attempt)`,
    )
    .join("\n");

  const sessionLines = submitted
    .map(
      (m, i) =>
        `- Sesi ${i + 1}: ${m.score}/${m.maxScore} (${Math.round((m.score! / m.maxScore!) * 100)}%) · ${m.mockId}`,
    )
    .join("\n");

  const recentLines = recentAttempts
    .slice(0, 12)
    .map(
      (a) =>
        `- ${a.createdAt.toISOString()} · ${TOPIC_LABELS[a.topic] ?? a.topic} · ${a.score}/${a.maxScore} · ${a.source}`,
    )
    .join("\n");

  return `DATA PERFORMA SISWA (untuk konseling; jangan sebutkan ID internal):
Nama: ${profile?.name ?? "Siswa"}
Kelas: ${profile?.grade ?? "—"} · Kota: ${profile?.city ?? "—"}

Kesiapan OSN AI: ${readiness.score}/100 · ${readiness.label}
Faktor: mastery ${readiness.factors.mastery}% · skor mock ${readiness.factors.mockScore}% · cakupan topik ${readiness.factors.coverage}% · volume mock ${readiness.factors.mockVolume}%
Fokus gap: ${readiness.topGaps.map((g) => g.label).join(", ") || "—"}

Mastery keseluruhan (topik dengan attempt): ${Math.round(overallMastery(allTopics) * 100)}%
Attempt tercatat (agregat mastery): ${attemptsCount}
Mock selesai: ${submitted.length} / sesi mock ${userMocks.length}
Rata-rata skor mock lifetime: ${submitted.length ? `${(avgLifetimeScore * 100).toFixed(1)}%` : "belum ada"}

Skor per sesi mock (tua → baru):
${sessionLines || "(belum ada mock submit)"}

Gap prioritas:
${gaps || "(belum cukup data)"}

Attempt terbaru:
${recentLines || "(belum ada attempt)"}`;
}
