import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, mockSessions, topicMastery } from "@/db/schema";
import { requireApiUser } from "@/lib/api";
import { overallMastery, rankGaps } from "@/lib/analytics/mastery";
import { TOPIC_LABELS, TRACKS } from "@/lib/content/types";
import { getLessons, getProblems } from "@/lib/content/load";

export async function GET(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  const db = await getDb();
  const userId = authResult.user.id;

  const masteryRows = await db
    .select()
    .from(topicMastery)
    .where(eq(topicMastery.userId, userId));

  const allTopics = Object.entries(TRACKS).flatMap(([track, meta]) =>
    meta.topics.map((topic) => {
      const row = masteryRows.find((m) => m.topic === topic);
      return {
        track,
        topic,
        label: TOPIC_LABELS[topic] ?? topic,
        mastery: row?.mastery ?? 0,
        attemptsCount: row?.attemptsCount ?? 0,
        correctCount: row?.correctCount ?? 0,
        avgDurationMs: row?.avgDurationMs ?? 0,
      };
    }),
  );

  const gaps = rankGaps(allTopics).slice(0, 5);
  const lessons = getLessons();
  const problems = getProblems();
  const recommendations = gaps.map((g) => ({
    ...g,
    lessonId: lessons.find((l) => l.topic === g.topic)?.id,
    practiceId: problems.find((p) => p.topic === g.topic)?.id,
  }));

  const recentAttempts = await db
    .select()
    .from(attempts)
    .where(eq(attempts.userId, userId))
    .orderBy(desc(attempts.createdAt))
    .limit(30);

  const recentMocks = await db
    .select()
    .from(mockSessions)
    .where(eq(mockSessions.userId, userId))
    .orderBy(desc(mockSessions.startedAt))
    .limit(10);

  const byDay: Record<string, { correct: number; total: number }> = {};
  for (const a of recentAttempts) {
    const day = new Date(a.createdAt).toISOString().slice(0, 10);
    byDay[day] ??= { correct: 0, total: 0 };
    byDay[day].total += 1;
    if (a.isCorrect) byDay[day].correct += 1;
  }

  const trend = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({
      day,
      accuracy: v.total ? v.correct / v.total : 0,
      attempts: v.total,
    }));

  const typeBreakdown: Record<string, { correct: number; total: number }> = {};
  for (const a of recentAttempts) {
    typeBreakdown[a.answerType] ??= { correct: 0, total: 0 };
    typeBreakdown[a.answerType].total += 1;
    if (a.isCorrect) typeBreakdown[a.answerType].correct += 1;
  }

  return Response.json({
    overall: overallMastery(allTopics),
    topics: allTopics,
    gaps: recommendations,
    trend,
    typeBreakdown,
    recentMocks: recentMocks.map((m) => ({
      id: m.id,
      mockId: m.mockId,
      status: m.status,
      score: m.score,
      maxScore: m.maxScore,
      startedAt: m.startedAt,
      submittedAt: m.submittedAt,
    })),
    totals: {
      attempts: recentAttempts.length,
      accuracy:
        recentAttempts.length === 0
          ? 0
          : recentAttempts.filter((a) => a.isCorrect).length /
            recentAttempts.length,
      avgDurationMs:
        recentAttempts.length === 0
          ? 0
          : Math.round(
              recentAttempts.reduce((s, a) => s + a.durationMs, 0) /
                recentAttempts.length,
            ),
    },
  });
}
