import { and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { attempts, topicMastery } from "@/db/schema";
import { computeTopicMastery } from "@/lib/analytics/mastery";

export type ProblemProgress = {
  problemId: string;
  attemptCount: number;
  /** Best score across attempts, 0–1. */
  bestScore: number;
  /** Most recent attempt score, 0–1. */
  lastScore: number;
  lastCorrect: boolean;
  everCorrect: boolean;
};

/** Aggregate practice progress for a student, keyed by problemId. */
export async function getUserProblemProgress(
  userId: string,
  problemIds?: string[],
): Promise<Map<string, ProblemProgress>> {
  const db = await getDb();
  const rows = await db
    .select({
      problemId: attempts.problemId,
      score: attempts.score,
      isCorrect: attempts.isCorrect,
      createdAt: attempts.createdAt,
    })
    .from(attempts)
    .where(
      problemIds && problemIds.length > 0
        ? and(
            eq(attempts.userId, userId),
            inArray(attempts.problemId, problemIds),
          )
        : eq(attempts.userId, userId),
    )
    .orderBy(desc(attempts.createdAt));

  const map = new Map<string, ProblemProgress>();
  for (const row of rows) {
    const existing = map.get(row.problemId);
    if (!existing) {
      map.set(row.problemId, {
        problemId: row.problemId,
        attemptCount: 1,
        bestScore: row.score,
        lastScore: row.score,
        lastCorrect: row.isCorrect,
        everCorrect: row.isCorrect,
      });
      continue;
    }
    existing.attemptCount += 1;
    existing.bestScore = Math.max(existing.bestScore, row.score);
    if (row.isCorrect) existing.everCorrect = true;
  }
  return map;
}

export async function recordAttempt(input: {
  userId: string;
  problemId: string;
  source?: string;
  track: string;
  topic: string;
  difficulty: number;
  answerType: string;
  submittedAnswer: unknown;
  isCorrect: boolean;
  score: number;
  maxScore?: number;
  durationMs?: number;
  mockSessionId?: string;
}) {
  const db = await getDb();
  const id = nanoid();
  await db.insert(attempts).values({
    id,
    userId: input.userId,
    problemId: input.problemId,
    source: input.source ?? "curated",
    track: input.track,
    topic: input.topic,
    difficulty: input.difficulty,
    answerType: input.answerType,
    submittedAnswer: input.submittedAnswer as object,
    isCorrect: input.isCorrect,
    score: input.score,
    maxScore: input.maxScore ?? 1,
    durationMs: input.durationMs ?? 0,
    mockSessionId: input.mockSessionId,
  });

  const topicAttempts = await db
    .select()
    .from(attempts)
    .where(eq(attempts.userId, input.userId));

  const filtered = topicAttempts.filter((a) => a.topic === input.topic);
  const stats = computeTopicMastery(filtered);

  const existing = await db.query.topicMastery.findFirst({
    where: (t, { and, eq: e }) =>
      and(e(t.userId, input.userId), e(t.topic, input.topic)),
  });

  if (existing) {
    await db
      .update(topicMastery)
      .set({
        mastery: stats.mastery,
        attemptsCount: stats.attemptsCount,
        correctCount: stats.correctCount,
        avgDurationMs: stats.avgDurationMs,
        updatedAt: new Date(),
      })
      .where(eq(topicMastery.id, existing.id));
  } else {
    await db.insert(topicMastery).values({
      id: nanoid(),
      userId: input.userId,
      track: input.track,
      topic: input.topic,
      mastery: stats.mastery,
      attemptsCount: stats.attemptsCount,
      correctCount: stats.correctCount,
      avgDurationMs: stats.avgDurationMs,
    });
  }

  return id;
}

/** Rebuild all topic_mastery rows for a user from current attempts. */
export async function rebuildTopicMasteryForUser(userId: string) {
  const db = await getDb();
  const allAttempts = await db
    .select()
    .from(attempts)
    .where(eq(attempts.userId, userId));

  await db.delete(topicMastery).where(eq(topicMastery.userId, userId));

  const byTopic = new Map<string, typeof allAttempts>();
  for (const row of allAttempts) {
    const list = byTopic.get(row.topic) ?? [];
    list.push(row);
    byTopic.set(row.topic, list);
  }

  let topics = 0;
  for (const [topic, rows] of byTopic) {
    const stats = computeTopicMastery(rows);
    if (stats.attemptsCount === 0) continue;
    const track = rows[0]?.track ?? "unknown";
    await db.insert(topicMastery).values({
      id: nanoid(),
      userId,
      track,
      topic,
      mastery: stats.mastery,
      attemptsCount: stats.attemptsCount,
      correctCount: stats.correctCount,
      avgDurationMs: stats.avgDurationMs,
    });
    topics += 1;
  }

  return { topics, attempts: allAttempts.length };
}
