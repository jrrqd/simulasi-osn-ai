import { requireApiUser } from "@/lib/api";
import {
  getUserLessonProgress,
  upsertLessonProgress,
} from "@/lib/lesson-progress";
import { getLesson } from "@/lib/content/load";
import {
  getLessonCheckQuestions,
  getUserCheckAttempts,
  recordCheckAttempt,
} from "@/lib/lesson-checks";
import { recordAttempt } from "@/lib/attempts";

export async function GET(req: Request) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;

  const map = await getUserLessonProgress(authResult.user.id);
  const progress = Object.fromEntries(
    [...map.entries()].map(([lessonId, row]) => [
      lessonId,
      {
        lessonId: row.lessonId,
        status: row.status,
        checksPassed: row.checksPassed,
        completedAt: row.completedAt,
        updatedAt: row.updatedAt,
      },
    ]),
  );

  return Response.json({ progress });
}

export async function POST(req: Request) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;

  const body = (await req.json().catch(() => null)) as {
    lessonId?: unknown;
    checksPassed?: unknown;
    complete?: unknown;
    checkResult?: { questionId?: unknown; correct?: unknown };
  } | null;

  if (!body || typeof body.lessonId !== "string" || !body.lessonId.trim()) {
    return Response.json({ error: "lessonId wajib" }, { status: 400 });
  }

  const lesson = getLesson(body.lessonId);
  if (!lesson) {
    return Response.json({ error: "Modul tidak ditemukan" }, { status: 404 });
  }

  let checksPassed: Record<string, boolean> | undefined;
  if (body.checksPassed != null) {
    if (
      typeof body.checksPassed !== "object" ||
      Array.isArray(body.checksPassed)
    ) {
      return Response.json({ error: "checksPassed tidak valid" }, { status: 400 });
    }
    checksPassed = {};
    for (const [k, v] of Object.entries(
      body.checksPassed as Record<string, unknown>,
    )) {
      if (typeof v === "boolean") checksPassed[k] = v;
    }
  }

  let srs: {
    questionId: string;
    wrongStreak: number;
    dueAt: string;
  } | null = null;

  try {
    const checkResult = body.checkResult;
    if (
      checkResult &&
      typeof checkResult.questionId === "string" &&
      typeof checkResult.correct === "boolean"
    ) {
      const questions = await getLessonCheckQuestions(body.lessonId);
      const q = questions.find((x) => x.id === checkResult.questionId);
      const row = await recordCheckAttempt({
        userId: authResult.user.id,
        lessonId: body.lessonId,
        questionId: checkResult.questionId,
        correct: checkResult.correct,
      });
      srs = {
        questionId: row.questionId,
        wrongStreak: row.wrongStreak,
        dueAt: row.dueAt.toISOString(),
      };

      // Feed topic mastery when correct (lightweight telemetry)
      if (checkResult.correct && q) {
        await recordAttempt({
          userId: authResult.user.id,
          problemId: `lesson-check:${body.lessonId}:${q.id}`,
          source: "curated",
          track: lesson.track,
          topic: lesson.topic,
          difficulty: q.difficulty ?? 2,
          answerType: q.answerType,
          submittedAnswer: { check: true },
          isCorrect: true,
          score: 1,
          maxScore: 1,
          durationMs: 0,
        });
      }
    }

    const row = await upsertLessonProgress({
      userId: authResult.user.id,
      lessonId: body.lessonId,
      checksPassed,
      complete: body.complete === true,
    });

    // Auto-complete when all current checks passed
    const allChecks = await getLessonCheckQuestions(body.lessonId);
    const passedMap = row.checksPassed;
    const allPassed =
      allChecks.length > 0 && allChecks.every((q) => passedMap[q.id] === true);
    let progress = row;
    if (allPassed && row.status !== "completed") {
      progress = await upsertLessonProgress({
        userId: authResult.user.id,
        lessonId: body.lessonId,
        complete: true,
      });
    }

    const attemptsMap = await getUserCheckAttempts(
      authResult.user.id,
      body.lessonId,
    );

    return Response.json({
      progress,
      srs,
      srsByQuestion: Object.fromEntries(
        [...attemptsMap.entries()].map(([id, a]) => [
          id,
          {
            questionId: id,
            wrongStreak: a.wrongStreak,
            dueAt: a.dueAt.toISOString(),
            correctCount: a.correctCount,
          },
        ]),
      ),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Gagal menyimpan" },
      { status: 400 },
    );
  }
}
