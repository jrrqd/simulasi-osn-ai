import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { attempts, topicMastery } from "@/db/schema";
import { computeTopicMastery } from "@/lib/analytics/mastery";

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
