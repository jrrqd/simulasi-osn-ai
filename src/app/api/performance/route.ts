import { NextRequest } from "next/server";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, mockSessions, topicMastery } from "@/db/schema";
import { requireApiUser } from "@/lib/api";
import { overallMastery, rankGaps, suggestedLessonsFromGaps } from "@/lib/analytics/mastery";
import {
  computeOsnReadiness,
  syllabusTopicsFromMastery,
} from "@/lib/analytics/readiness";
import { TOPIC_LABELS, TRACKS } from "@/lib/content/types";
import { getLessons, getProblems } from "@/lib/content/load";
import { resolveProblem } from "@/lib/content/shared";
import { countVisiblePracticeProblems } from "@/lib/content/problem-library";
import { getUserLessonProgress } from "@/lib/lesson-progress";
import { dayKeyWib } from "@/lib/datetime";
import { buildCampaignPayload } from "@/lib/campaign-stages";

export async function GET(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  const db = await getDb();
  const userId = authResult.user.id;

  const [
    masteryRows,
    recentAttempts,
    practiceAttempts,
    userMocks,
    lessonProgressMap,
    practiceBankTotal,
  ] = await Promise.all([
    db.select().from(topicMastery).where(eq(topicMastery.userId, userId)),
    db
      .select()
      .from(attempts)
      .where(eq(attempts.userId, userId))
      .orderBy(desc(attempts.createdAt))
      .limit(30),
    db
      .select()
      .from(attempts)
      .where(and(eq(attempts.userId, userId), isNull(attempts.mockSessionId)))
      .orderBy(desc(attempts.createdAt)),
    db
      .select()
      .from(mockSessions)
      .where(eq(mockSessions.userId, userId))
      .orderBy(asc(mockSessions.startedAt)),
    getUserLessonProgress(userId),
    countVisiblePracticeProblems(),
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
        correctCount: row?.correctCount ?? 0,
        avgDurationMs: row?.avgDurationMs ?? 0,
      };
    }),
  );

  const gaps = rankGaps(allTopics).slice(0, 5);
  const lessons = getLessons();
  const problems = getProblems();
  const completedLessonIds = new Set(
    [...lessonProgressMap.entries()]
      .filter(([, row]) => row.status === "completed")
      .map(([id]) => id),
  );
  const recommendations = gaps.map((g) => ({
    ...g,
    lessonId: lessons.find(
      (l) => l.topic === g.topic && !completedLessonIds.has(l.id),
    )?.id ?? lessons.find((l) => l.topic === g.topic)?.id,
    practiceId: problems.find((p) => p.topic === g.topic)?.id,
  }));
  const suggestedLessons = suggestedLessonsFromGaps({
    gaps,
    lessons,
    completedLessonIds,
    limit: 3,
  });

  const byDay: Record<string, { correct: number; total: number }> = {};
  for (const a of recentAttempts) {
    const day = dayKeyWib(a.createdAt);
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

  const submitted = userMocks.filter(
    (m) =>
      m.status === "submitted" &&
      m.score != null &&
      m.maxScore != null &&
      m.maxScore > 0,
  );
  const avgMockScore = submitted.length
    ? submitted.reduce((sum, m) => sum + m.score! / m.maxScore!, 0) /
      submitted.length
    : 0;
  const avgScorePoints = submitted.length
    ? submitted.reduce((sum, m) => sum + m.score!, 0) / submitted.length
    : 0;
  const avgMaxPoints = submitted.length
    ? submitted.reduce((sum, m) => sum + m.maxScore!, 0) / submitted.length
    : 0;

  const sessionScores = submitted.map((m, index) => ({
    index: index + 1,
    label: `Sesi ${index + 1}`,
    mockId: m.mockId,
    score: m.score!,
    maxScore: m.maxScore!,
    percent: Math.round((m.score! / m.maxScore!) * 1000) / 10,
    startedAt: m.startedAt,
    submittedAt: m.submittedAt,
  }));

  const attemptsCount = allTopics.reduce((sum, t) => sum + t.attemptsCount, 0);
  const readiness = computeOsnReadiness({
    topics: syllabusTopicsFromMastery(
      masteryRows.map((m) => ({
        topic: m.topic,
        mastery: m.mastery,
        attemptsCount: m.attemptsCount,
      })),
    ),
    avgMockScoreRatio: avgMockScore,
    completedMocks: submitted.length,
    attemptsCount,
  });

  const recentMocks = [...userMocks]
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, 10);

  const practiceTitleCache = new Map<string, string>();
  const recentPractice = [];
  for (const a of practiceAttempts.slice(0, 40)) {
    let title = practiceTitleCache.get(a.problemId);
    if (!title) {
      const problem = await resolveProblem(a.problemId);
      title = problem?.title?.trim() || a.problemId;
      practiceTitleCache.set(a.problemId, title);
    }
    recentPractice.push({
      id: a.id,
      problemId: a.problemId,
      title,
      topic: a.topic,
      topicLabel: TOPIC_LABELS[a.topic] ?? a.topic,
      track: a.track,
      source: a.source,
      isCorrect: a.isCorrect,
      score: a.score,
      maxScore: a.maxScore,
      durationMs: a.durationMs,
      createdAt: a.createdAt,
    });
  }

  const practiceCorrect = practiceAttempts.filter((a) => a.isCorrect).length;
  const practiceDone = new Set(practiceAttempts.map((a) => a.problemId)).size;
  const practiceTotal = practiceBankTotal;
  const practiceSummary = {
    attempts: practiceAttempts.length,
    correct: practiceCorrect,
    done: practiceDone,
    total: practiceTotal,
    accuracy:
      practiceAttempts.length === 0
        ? 0
        : practiceCorrect / practiceAttempts.length,
    avgScore:
      practiceAttempts.length === 0
        ? 0
        : practiceAttempts.reduce(
            (s, a) => s + a.score / Math.max(a.maxScore || 1, 1),
            0,
          ) / practiceAttempts.length,
  };

  const allLessons = getLessons();
  const levelsCompleted = allLessons.filter(
    (l) => lessonProgressMap.get(l.id)?.status === "completed",
  ).length;
  const campaign = buildCampaignPayload({
    levelsCompleted,
    totalLevels: allLessons.length,
    sideQuestAttempts: practiceSummary.attempts,
    sideQuestCorrect: practiceSummary.correct,
    sideQuestDone: practiceDone,
    sideQuestTotal: practiceTotal,
    completedMocks: submitted.length,
  });

  return Response.json({
    overall: overallMastery(allTopics),
    topics: allTopics,
    gaps: recommendations,
    suggestedLessons,
    trend,
    typeBreakdown,
    readiness,
    sessionScores,
    campaign,
    recentMocks: recentMocks.map((m) => ({
      id: m.id,
      mockId: m.mockId,
      status: m.status,
      score: m.score,
      maxScore: m.maxScore,
      startedAt: m.startedAt,
      submittedAt: m.submittedAt,
    })),
    recentPractice,
    practiceSummary,
    totals: {
      attempts: recentAttempts.length,
      attemptsTotal: attemptsCount,
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
      completedMocks: submitted.length,
      avgMockScore,
      avgScorePoints,
      avgMaxPoints,
    },
  });
}
