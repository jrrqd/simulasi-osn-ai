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

function penaltySummaryPayload(state: ReturnType<typeof normalizePenaltyState>) {
  return {
    penaltyState: state,
    penaltyMinutes: totalPenaltyMinutes(state),
    totalAttempts: totalAttempts(state),
  };
}

/**
 * Kaggle-style competition submit:
 * - action=preview: validate columns/rows only
 * - action=grade: full metric grading (Submit button)
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
  const sessionId = String(form.get("sessionId") ?? "");
  const problemId = String(form.get("problemId") ?? "");
  const action = String(form.get("action") ?? "grade");
  const submissionFile = form.get("submission");
  const notebookFile = form.get("notebook");

  if (!sessionId || !problemId) {
    return Response.json(
      { error: "sessionId dan problemId wajib" },
      { status: 400 },
    );
  }

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

  const mockProblems = mockMeta?.problemIds ?? [];
  if (!mockProblems.includes(problemId)) {
    return Response.json(
      { error: "Soal tidak termasuk simulasi ini" },
      { status: 400 },
    );
  }

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

  // Full grade
  const settings = await getEffectiveAiSettings(auth.user.id);
  const grade = await gradeCompetitionSubmission({
    competition: problem.competitionSpec,
    submissionCsv,
    notebookJson,
    llmAssist:
      settings && (!submissionCsv || submissionCsv.length < 20)
        ? async (p) =>
            llmAssistCompetitionCsv({
              baseUrl: settings.baseUrl,
              apiKey: settings.apiKey,
              modelId: settings.modelId,
              ...p,
            })
        : settings
          ? async (p) => {
              // Also assist when deterministic path will fail on bad columns
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
    submitted: submissionCsv ?? "",
    expected: "lihat submission",
    competitionResult,
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

  // Append to logs history stored under __competitionLogs
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
