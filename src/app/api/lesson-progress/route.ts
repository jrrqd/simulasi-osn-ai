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
import { scoreCheckQuestion } from "@/lib/scoring";

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
    complete?: unknown;
    submission?: { questionId?: unknown; answer?: unknown };
  } | null;

  if (!body || typeof body.lessonId !== "string" || !body.lessonId.trim()) {
    return Response.json({ error: "lessonId wajib" }, { status: 400 });
  }

  const lesson = getLesson(body.lessonId);
  if (!lesson) {
    return Response.json({ error: "Modul tidak ditemukan" }, { status: 404 });
  }

  let srs: {
    questionId: string;
    wrongStreak: number;
    dueAt: string;
  } | null = null;
  let grade: {
    questionId: string;
    correct: boolean;
    formatHint?: string;
    explanation: string;
    answer: string;
  } | null = null;

  try {
    const questions = await getLessonCheckQuestions(body.lessonId);
    const existing = (await getUserLessonProgress(authResult.user.id)).get(
      body.lessonId,
    );
    const checksPassed: Record<string, boolean> = {
      ...(existing?.checksPassed ?? {}),
    };

    const submission = body.submission;
    if (submission && typeof submission.questionId === "string") {
      const q = questions.find((x) => x.id === submission.questionId);
      if (!q) {
        return Response.json(
          { error: "Soal cek konsep tidak ditemukan" },
          { status: 404 },
        );
      }
      const result = scoreCheckQuestion(q, submission.answer);
      checksPassed[q.id] = result.correct;
      grade = {
        questionId: q.id,
        correct: result.correct,
        formatHint: result.formatHint,
        explanation: q.explanation,
        answer: String(q.answer),
      };
      const row = await recordCheckAttempt({
        userId: authResult.user.id,
        lessonId: body.lessonId,
        questionId: q.id,
        correct: result.correct,
      });
      srs = {
        questionId: row.questionId,
        wrongStreak: row.wrongStreak,
        dueAt: row.dueAt.toISOString(),
      };
      if (result.correct) {
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

    const allPassed =
      questions.length > 0 &&
      questions.every((q) => checksPassed[q.id] === true);
    const progress = await upsertLessonProgress({
      userId: authResult.user.id,
      lessonId: body.lessonId,
      checksPassed,
      complete:
        questions.length === 0
          ? body.complete === true
          : allPassed,
    });
    if (body.complete === true && questions.length > 0 && !allPassed) {
      return Response.json(
        {
          error:
            "Selesaikan semua cek konsep dengan benar sebelum menandai level selesai.",
          progress,
          grade,
        },
        { status: 400 },
      );
    }

    const attemptsMap = await getUserCheckAttempts(
      authResult.user.id,
      body.lessonId,
    );

    return Response.json({
      progress,
      grade,
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
