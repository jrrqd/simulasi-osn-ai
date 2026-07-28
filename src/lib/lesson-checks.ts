import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { checkAttempts, generatedLessonChecks } from "@/db/schema";
import { getLesson, normalizeCheckQuestion } from "@/lib/content/load";
import type { CheckQuestion } from "@/lib/content/types";
import { applySrsReview, isDue, type SrsState } from "@/lib/srs";

/** Curated + visible AI/admin extras for a lesson. */
export async function getLessonCheckQuestions(
  lessonId: string,
): Promise<CheckQuestion[]> {
  const lesson = getLesson(lessonId);
  const curated = lesson?.checkQuestions ?? [];
  const db = await getDb();
  const extras = await db
    .select()
    .from(generatedLessonChecks)
    .where(
      and(
        eq(generatedLessonChecks.lessonId, lessonId),
        eq(generatedLessonChecks.hidden, false),
      ),
    );

  const extraQs = extras
    .map((row) =>
      normalizeCheckQuestion({
        ...row.payload,
        id: row.id,
        source: (row.payload as { source?: string }).source ?? "ai",
      }),
    )
    .filter((q): q is CheckQuestion => Boolean(q));

  // Prefer extra overwrite when same id
  const byId = new Map<string, CheckQuestion>();
  for (const q of curated) byId.set(q.id, q);
  for (const q of extraQs) byId.set(q.id, q);
  return Array.from(byId.values());
}

export async function listGeneratedLessonChecks(params?: {
  lessonId?: string;
  includeHidden?: boolean;
}) {
  const db = await getDb();
  const rows = params?.lessonId
    ? await db
        .select()
        .from(generatedLessonChecks)
        .where(eq(generatedLessonChecks.lessonId, params.lessonId))
    : await db.select().from(generatedLessonChecks);

  return rows.filter((r) => params?.includeHidden || !r.hidden);
}

export async function upsertGeneratedCheck(input: {
  lessonId: string;
  question: CheckQuestion;
  createdBy?: string;
  id?: string;
}) {
  const db = await getDb();
  const id = input.id ?? input.question.id ?? `chk-${nanoid(10)}`;
  const payload = { ...input.question, id, source: input.question.source ?? "ai" };
  const existing = await db.query.generatedLessonChecks.findFirst({
    where: eq(generatedLessonChecks.id, id),
  });
  const now = new Date();
  if (existing) {
    const [updated] = await db
      .update(generatedLessonChecks)
      .set({
        payload,
        hidden: false,
        updatedAt: now,
      })
      .where(eq(generatedLessonChecks.id, id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(generatedLessonChecks)
    .values({
      id,
      lessonId: input.lessonId,
      payload,
      hidden: false,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return created;
}

export async function setGeneratedCheckHidden(id: string, hidden: boolean) {
  const db = await getDb();
  const [row] = await db
    .update(generatedLessonChecks)
    .set({ hidden, updatedAt: new Date() })
    .where(eq(generatedLessonChecks.id, id))
    .returning();
  return row ?? null;
}

export type CheckAttemptRow = {
  questionId: string;
  ease: number;
  intervalDays: number;
  correctCount: number;
  wrongStreak: number;
  dueAt: Date;
  lastSeenAt: Date;
};

export async function getUserCheckAttempts(
  userId: string,
  lessonId: string,
): Promise<Map<string, CheckAttemptRow>> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(checkAttempts)
    .where(
      and(eq(checkAttempts.userId, userId), eq(checkAttempts.lessonId, lessonId)),
    );
  const map = new Map<string, CheckAttemptRow>();
  for (const r of rows) {
    map.set(r.questionId, {
      questionId: r.questionId,
      ease: r.ease,
      intervalDays: r.intervalDays,
      correctCount: r.correctCount,
      wrongStreak: r.wrongStreak,
      dueAt: r.dueAt,
      lastSeenAt: r.lastSeenAt,
    });
  }
  return map;
}

export async function recordCheckAttempt(input: {
  userId: string;
  lessonId: string;
  questionId: string;
  correct: boolean;
}): Promise<CheckAttemptRow> {
  const db = await getDb();
  const existing = await db.query.checkAttempts.findFirst({
    where: and(
      eq(checkAttempts.userId, input.userId),
      eq(checkAttempts.lessonId, input.lessonId),
      eq(checkAttempts.questionId, input.questionId),
    ),
  });

  const prev: SrsState | null = existing
    ? {
        ease: existing.ease,
        intervalDays: existing.intervalDays,
        correctCount: existing.correctCount,
        wrongStreak: existing.wrongStreak,
        dueAt: existing.dueAt,
        lastSeenAt: existing.lastSeenAt,
      }
    : null;

  const next = applySrsReview(prev, input.correct);
  const now = new Date();

  if (existing) {
    const [updated] = await db
      .update(checkAttempts)
      .set({
        ease: next.ease,
        intervalDays: next.intervalDays,
        correctCount: next.correctCount,
        wrongStreak: next.wrongStreak,
        dueAt: next.dueAt,
        lastSeenAt: next.lastSeenAt,
        updatedAt: now,
      })
      .where(eq(checkAttempts.id, existing.id))
      .returning();
    return {
      questionId: updated.questionId,
      ease: updated.ease,
      intervalDays: updated.intervalDays,
      correctCount: updated.correctCount,
      wrongStreak: updated.wrongStreak,
      dueAt: updated.dueAt,
      lastSeenAt: updated.lastSeenAt,
    };
  }

  const [created] = await db
    .insert(checkAttempts)
    .values({
      id: nanoid(),
      userId: input.userId,
      lessonId: input.lessonId,
      questionId: input.questionId,
      ease: next.ease,
      intervalDays: next.intervalDays,
      correctCount: next.correctCount,
      wrongStreak: next.wrongStreak,
      dueAt: next.dueAt,
      lastSeenAt: next.lastSeenAt,
      updatedAt: now,
    })
    .returning();

  return {
    questionId: created.questionId,
    ease: created.ease,
    intervalDays: created.intervalDays,
    correctCount: created.correctCount,
    wrongStreak: created.wrongStreak,
    dueAt: created.dueAt,
    lastSeenAt: created.lastSeenAt,
  };
}

export function dueQuestionIds(
  attempts: Map<string, CheckAttemptRow>,
  questionIds: string[],
  now = new Date(),
): string[] {
  return questionIds.filter((id) => {
    const row = attempts.get(id);
    if (!row) return true;
    return isDue(
      {
        ease: row.ease,
        intervalDays: row.intervalDays,
        correctCount: row.correctCount,
        wrongStreak: row.wrongStreak,
        dueAt: row.dueAt,
        lastSeenAt: row.lastSeenAt,
      },
      now,
    );
  });
}

export async function getDueCountsForUser(
  userId: string,
  lessonIds: string[],
): Promise<Map<string, number>> {
  if (lessonIds.length === 0) return new Map();
  const db = await getDb();
  const rows = await db
    .select()
    .from(checkAttempts)
    .where(
      and(
        eq(checkAttempts.userId, userId),
        inArray(checkAttempts.lessonId, lessonIds),
      ),
    );
  const now = Date.now();
  const dueByLesson = new Map<string, number>();
  for (const r of rows) {
    if (r.dueAt.getTime() <= now) {
      dueByLesson.set(r.lessonId, (dueByLesson.get(r.lessonId) ?? 0) + 1);
    }
  }
  return dueByLesson;
}
