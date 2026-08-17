import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mockSessions, submissionEvents } from "@/db/schema";
import { requireApiUser } from "@/lib/api";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import { llmAssistCompetitionCsv } from "@/lib/ai/grade-competition-submission";
import { resolveProblem, resolveMock } from "@/lib/content/shared";
import {
  gradeCompetitionSubmission,
  previewCompetitionSubmission,
} from "@/lib/scoring/grade-competition";
import { scoreAnswer, type CompetitionRunResult } from "@/lib/scoring";
import {
  DEFAULT_PENALTY_MINUTES_PER_WRONG,
  normalizePenaltyState,
  recordSubmission,
  totalAttempts,
  totalPenaltyMinutes,
} from "@/lib/exam/penalty";
import { extractSubmissionCsvFromNotebook } from "@/lib/notebook/build-starter-notebook";
import { recordAttempt } from "@/lib/attempts";
import type { Problem } from "@/lib/content/types";

function penaltySummaryPayload(state: ReturnType<typeof normalizePenaltyState>) {
  return {
    penaltyState: state,
    penaltyMinutes: totalPenaltyMinutes(state),
    totalAttempts: totalAttempts(state),
  };
}

async function readSubmissionPayload(form: FormData): Promise<{
  submissionCsv: string | null;
  notebookJson: string | null;
}> {
  const submissionFile = form.get("submission");
  const notebookFile = form.get("notebook");
  let submissionCsv: string | null = null;
  let notebookJson: string | null = null;

  if (submissionFile instanceof File && submissionFile.size > 0) {
    submissionCsv = await submissionFile.text();
  }
  if (notebookFile instanceof File && notebookFile.size > 0) {
    notebookJson = await notebookFile.text();
    if (!submissionCsv) {
      submissionCsv = extractSubmissionCsvFromNotebook(notebookJson);
    }
  }
  return { submissionCsv, notebookJson };
}

async function runGrade(params: {
  userId: string;
  problem: Problem;
  submissionCsv: string | null;
  notebookJson: string | null;
}) {
  const settings = await getEffectiveAiSettings(params.userId);
  const grade = await gradeCompetitionSubmission({
    competition: params.problem.competitionSpec!,
    submissionCsv: params.submissionCsv,
    notebookJson: params.notebookJson,
    llmAssist:
      settings && (!params.submissionCsv || params.submissionCsv.length < 20)
        ? async (p) =>
            llmAssistCompetitionCsv({
              baseUrl: settings.baseUrl,
              apiKey: settings.apiKey,
              modelId: settings.modelId,
              ...p,
            })
        : settings
          ? async (p) => {
              if (p.submissionCsv && p.notebookJson) {
                return llmAssistCompetitionCsv({
                  baseUrl: settings.baseUrl,
                  apiKey: settings.apiKey,
                  modelId: settings.modelId,
                  ...p,
                });
              }
              return null;
            }
          : undefined,
  });

  const competitionResult: CompetitionRunResult = {
    metricValue: grade.metricValue,
    score: grade.score,
    metricLabel: grade.metricLabel,
    log: grade.log,
    summary: grade.summary,
    rowCount: grade.rowCount,
    gradedBy: grade.gradedBy,
  };

  const graded = scoreAnswer({
    answerType: "notebook_submission",
    submitted: params.submissionCsv ?? "",
    expected: "lihat submission",
    competitionResult,
  });

  return { grade, competitionResult, graded };
}

/**
 * Kaggle-style competition submit:
 * - mode=mock (default): requires live mock session
 * - mode=practice: untimed Latihan — grades + records attempt + returns solution
 * - action=preview | grade
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req);
  if ("error" in auth) return auth.error;

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json(
      { error: "Gunakan multipart/form-data (file submission)." },
      { status: 400 },
    );
  }

  const form = await req.formData();
  const mode = String(form.get("mode") ?? "mock");
  const sessionId = String(form.get("sessionId") ?? "");
  const problemId = String(form.get("problemId") ?? "");
  const action = String(form.get("action") ?? "grade");
  const durationMs = Number(form.get("durationMs") ?? 0);

  if (!problemId) {
    return Response.json({ error: "problemId wajib" }, { status: 400 });
  }
  if (mode !== "practice" && !sessionId) {
    return Response.json(
      { error: "sessionId dan problemId wajib" },
      { status: 400 },
    );
  }

  const problem = await resolveProblem(problemId);
  if (
    !problem ||
    problem.answerType !== "notebook_submission" ||
    !problem.competitionSpec
  ) {
    return Response.json(
      { error: "Kompetisi tidak ditemukan" },
      { status: 404 },
    );
  }

  const { submissionCsv, notebookJson } = await readSubmissionPayload(form);
  if (!submissionCsv && !notebookJson) {
    return Response.json(
      { error: "Lampirkan submission.csv dan/atau notebook .ipynb" },
      { status: 400 },
    );
  }

  if (action === "preview") {
    if (!submissionCsv) {
      return Response.json({
        ok: false,
        rowCount: 0,
        headers: [],
        warnings: [
          "Tidak ada CSV yang bisa dibaca dari lampiran. Unggah submission.csv.",
        ],
      });
    }
    const preview = previewCompetitionSubmission({
      competition: problem.competitionSpec,
      submissionCsv,
    });
    return Response.json(preview);
  }

  // ——— Practice (untimed Latihan) ———
  if (mode === "practice") {
    const { competitionResult, graded } = await runGrade({
      userId: auth.user.id,
      problem,
      submissionCsv,
      notebookJson,
    });
    const isCorrect = graded.correct === true;
    const score01 = graded.score;
    const attemptId = await recordAttempt({
      userId: auth.user.id,
      problemId: problem.id,
      source: problem.source === "ai" ? "ai" : "curated",
      track: problem.track,
      topic: problem.topic,
      difficulty: problem.difficulty,
      answerType: problem.answerType,
      submittedAnswer: {
        kind: "competition_submission",
        metricValue: competitionResult.metricValue,
        score: competitionResult.score,
        metricLabel: competitionResult.metricLabel,
        log: competitionResult.log,
        rowCount: competitionResult.rowCount,
      },
      isCorrect,
      score: score01,
      maxScore: 1,
      durationMs: Number.isFinite(durationMs) ? durationMs : 0,
    });

    return Response.json({
      ok: true,
      mode: "practice",
      attemptId,
      correct: isCorrect,
      score: score01,
      competitionResult,
      solution: problem.solution,
    });
  }

  // ——— Mock exam session ———
  const db = await getDb();
  const session = await db.query.mockSessions.findFirst({
    where: eq(mockSessions.id, sessionId),
  });
  if (!session || session.userId !== auth.user.id) {
    return Response.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
  }
  if (session.submittedAt) {
    return Response.json(
      { error: "Sesi sudah dikumpulkan" },
      { status: 409 },
    );
  }
  if (Date.now() > session.endsAt.getTime() + 5_000) {
    return Response.json(
      { error: "Waktu ujian telah habis" },
      { status: 409 },
    );
  }

  const mockMeta = await resolveMock(session.mockId);
  const mockProblems = mockMeta?.problemIds ?? [];
  if (!mockProblems.includes(problemId)) {
    return Response.json(
      { error: "Soal tidak termasuk simulasi ini" },
      { status: 400 },
    );
  }

  const { grade, competitionResult, graded } = await runGrade({
    userId: auth.user.id,
    problem,
    submissionCsv,
    notebookJson,
  });

  const isCorrect = graded.correct === true;
  const minutesFromStart = Math.max(
    0,
    Math.floor((Date.now() - session.startedAt.getTime()) / 60_000),
  );

  const answerPayload = {
    kind: "competition_submission",
    metricValue: grade.metricValue,
    score: grade.score,
    metricLabel: grade.metricLabel,
    log: grade.log,
    summary: grade.summary,
    rowCount: grade.rowCount,
    gradedBy: grade.gradedBy,
    at: new Date().toISOString(),
  };

  const mergedAnswers = {
    ...((session.answers as Record<string, unknown>) ?? {}),
    [problemId]: answerPayload,
  };

  const logsKey = "__competitionLogs";
  const prevLogs =
    (mergedAnswers[logsKey] as Record<string, unknown[]>) ?? {};
  const problemLogs = Array.isArray(prevLogs[problemId])
    ? [...prevLogs[problemId]!]
    : [];
  problemLogs.push(answerPayload);
  mergedAnswers[logsKey] = { ...prevLogs, [problemId]: problemLogs };

  let penaltyPayload = {};
  if (mockMeta?.penaltyEnabled !== false) {
    const prevState = normalizePenaltyState(session.penaltyState);
    const recorded = recordSubmission({
      state: prevState,
      problemId,
      isCorrect,
      minutesFromStart,
      penaltyMinutesPerWrong:
        mockMeta?.penaltyMinutesPerWrong ?? DEFAULT_PENALTY_MINUTES_PER_WRONG,
    });
    await db.insert(submissionEvents).values({
      id: nanoid(),
      userId: auth.user.id,
      mockSessionId: sessionId,
      problemId,
      kind: "competition_submit",
      correct: isCorrect,
    });
    await db
      .update(mockSessions)
      .set({
        answers: mergedAnswers,
        penaltyState: recorded.state,
      })
      .where(eq(mockSessions.id, sessionId));
    penaltyPayload = penaltySummaryPayload(recorded.state);
  } else {
    await db.insert(submissionEvents).values({
      id: nanoid(),
      userId: auth.user.id,
      mockSessionId: sessionId,
      problemId,
      kind: "competition_submit",
      correct: isCorrect,
    });
    await db
      .update(mockSessions)
      .set({
        answers: mergedAnswers,
      })
      .where(eq(mockSessions.id, sessionId));
  }

  return Response.json({
    ok: true,
    correct: isCorrect,
    score: graded.score,
    competitionResult,
    ...penaltyPayload,
  });
}
