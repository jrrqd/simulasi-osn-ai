import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { lessonProgress } from "@/db/schema";
import { getLesson } from "@/lib/content/load";

export type LessonProgressRow = {
  lessonId: string;
  status: "in_progress" | "completed";
  checksPassed: Record<string, boolean>;
  completedAt: Date | null;
  updatedAt: Date;
};

function normalizeChecks(
  value: unknown,
): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

function allChecksPassed(
  lessonId: string,
  checksPassed: Record<string, boolean>,
): boolean {
  const lesson = getLesson(lessonId);
  if (!lesson) return false;
  const ids = lesson.checkQuestions.map((q) => q.id);
  if (ids.length === 0) return false;
  return ids.every((id) => checksPassed[id] === true);
}

export async function getUserLessonProgress(
  userId: string,
): Promise<Map<string, LessonProgressRow>> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(lessonProgress)
    .where(eq(lessonProgress.userId, userId));

  const map = new Map<string, LessonProgressRow>();
  for (const row of rows) {
    map.set(row.lessonId, {
      lessonId: row.lessonId,
      status: row.status === "completed" ? "completed" : "in_progress",
      checksPassed: normalizeChecks(row.checksPassed),
      completedAt: row.completedAt,
      updatedAt: row.updatedAt,
    });
  }
  return map;
}

export async function upsertLessonProgress(input: {
  userId: string;
  lessonId: string;
  checksPassed?: Record<string, boolean>;
  complete?: boolean;
}): Promise<LessonProgressRow> {
  const lesson = getLesson(input.lessonId);
  if (!lesson) {
    throw new Error("Modul tidak ditemukan");
  }

  const db = await getDb();
  const existingRows = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, input.userId),
        eq(lessonProgress.lessonId, input.lessonId),
      ),
    )
    .limit(1);
  const existing = existingRows[0];

  const mergedChecks = {
    ...normalizeChecks(existing?.checksPassed),
    ...(input.checksPassed ? normalizeChecks(input.checksPassed) : {}),
  };

  const shouldComplete =
    input.complete === true ||
    existing?.status === "completed" ||
    allChecksPassed(input.lessonId, mergedChecks);

  const now = new Date();
  const status = shouldComplete ? "completed" : "in_progress";
  const completedAt = shouldComplete
    ? (existing?.completedAt ?? now)
    : null;

  if (existing) {
    const [updated] = await db
      .update(lessonProgress)
      .set({
        status,
        checksPassed: mergedChecks,
        completedAt,
        updatedAt: now,
      })
      .where(eq(lessonProgress.id, existing.id))
      .returning();

    return {
      lessonId: updated.lessonId,
      status: updated.status === "completed" ? "completed" : "in_progress",
      checksPassed: normalizeChecks(updated.checksPassed),
      completedAt: updated.completedAt,
      updatedAt: updated.updatedAt,
    };
  }

  const [created] = await db
    .insert(lessonProgress)
    .values({
      id: nanoid(),
      userId: input.userId,
      lessonId: input.lessonId,
      status,
      checksPassed: mergedChecks,
      completedAt,
      updatedAt: now,
    })
    .returning();

  return {
    lessonId: created.lessonId,
    status: created.status === "completed" ? "completed" : "in_progress",
    checksPassed: normalizeChecks(created.checksPassed),
    completedAt: created.completedAt,
    updatedAt: created.updatedAt,
  };
}
