import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { mockSessions, submissionEvents } from "@/db/schema";
import { requireApiUser } from "@/lib/api";
import { rateLimit } from "@/lib/api";
import {
  listAllMocks,
  resolveMock,
  resolveProblemsForMock,
} from "@/lib/content/shared";
import {
  emptyIntegrityState,
  integritySummary,
  mergeIntegrityUpdate,
  normalizeIntegrityEvents,
  type IntegrityState,
} from "@/lib/exam-integrity";
import { scoreMockProblems } from "@/lib/mocks/scoring";
import { defaultProblemWeight } from "@/lib/content/types";
import { scoreAnswer, type CodeSpecRunResult } from "@/lib/scoring/index";
import { recordAttempt } from "@/lib/attempts";
import {
  DEFAULT_PENALTY_MINUTES_PER_WRONG,
  formatPenaltySummary,
  normalizePenaltyState,
  recordSubmission,
  totalAttempts,
  totalPenaltyMinutes,
} from "@/lib/exam/penalty";
import {
  GraderUnavailableError,
  gradeCodeWithJudge0,
  readJudge0Config,
} from "@/lib/grading/judge0";

export const runtime = "nodejs";

function sessionIntegrity(session: {
  integrityEvents?: unknown;
  integrityViolationCount?: number | null;
  integrityFlagged?: boolean | null;
  integrityForcedSubmit?: boolean | null;
}): IntegrityState {
  return {
    events: normalizeIntegrityEvents(session.integrityEvents),
    violationCount: session.integrityViolationCount ?? 0,
    flagged: Boolean(session.integrityFlagged),
    forcedSubmit: Boolean(session.integrityForcedSubmit),
  };
}

function integrityColumns(state: IntegrityState) {
  return {
    integrityEvents: state.events,
    integrityViolationCount: state.violationCount,
    integrityFlagged: state.flagged,
    integrityForcedSubmit: state.forcedSubmit,
  };
}

function penaltySummaryPayload(state: ReturnType<typeof normalizePenaltyState>) {
  const summary = formatPenaltySummary(state);
  return {
    penaltyState: state,
    scoreboard: summary.rows,
    totalAttempts: summary.totalAttempts,
    penaltyMinutes: summary.penaltyMinutes,
    solvedCount: summary.solvedCount,
  };
}

export async function GET(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  const mocks = await listAllMocks();
  return Response.json({ mocks });
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`mock-start:${authResult.user.id}`, 10, 60_000)) {
    return Response.json(
      { error: "Terlalu banyak percobaan. Coba lagi sebentar." },
      { status: 429 },
    );
  }
  const body = await req.json();
  const mockId = String(body.mockId ?? "");
  const mock = await resolveMock(mockId);
  if (!mock) {
    return Response.json({ error: "Mock tidak ditemukan" }, { status: 404 });
  }

  const db = await getDb();
  const existing = await db.query.mockSessions.findFirst({
    where: and(
      eq(mockSessions.userId, authResult.user.id),
      eq(mockSessions.mockId, mockId),
      eq(mockSessions.status, "in_progress"),
    ),
    orderBy: [desc(mockSessions.startedAt)],
  });
  if (existing) {
    const integrity = sessionIntegrity(existing);
    const penaltyState = normalizePenaltyState(existing.penaltyState);
    return Response.json({
      sessionId: existing.id,
      startedAt: existing.startedAt,
      endsAt: existing.endsAt,
      answers: existing.answers ?? {},
      resumed: true,
      integrity: integritySummary(integrity),
      penaltyEnabled: mock.penaltyEnabled !== false,
      penaltyMinutesPerWrong:
        mock.penaltyMinutesPerWrong ?? DEFAULT_PENALTY_MINUTES_PER_WRONG,
      ...penaltySummaryPayload(penaltyState),
    });
  }

  const id = nanoid();
  const startedAt = new Date();
  const endsAt = new Date(
    startedAt.getTime() + mock.durationMinutes * 60_000,
  );
  const integrity = emptyIntegrityState();
  await db.insert(mockSessions).values({
    id,
    userId: authResult.user.id,
    mockId,
    status: "in_progress",
    answers: {},
    startedAt,
    endsAt,
    penaltyState: {},
    totalAttempts: 0,
    penaltyMinutes: 0,
    ...integrityColumns(integrity),
  });

  return Response.json({
    sessionId: id,
    startedAt,
    endsAt,
    answers: {},
    resumed: false,
    integrity: integritySummary(integrity),
    penaltyEnabled: mock.penaltyEnabled !== false,
    penaltyMinutesPerWrong:
      mock.penaltyMinutesPerWrong ?? DEFAULT_PENALTY_MINUTES_PER_WRONG,
    ...penaltySummaryPayload({}),
  });
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`mock-patch:${authResult.user.id}`, 60, 60_000)) {
    return Response.json(
      { error: "Terlalu banyak percobaan. Coba lagi sebentar." },
      { status: 429 },
    );
  }
  const body = await req.json();
  const sessionId = String(body.sessionId ?? "");
  const action = String(body.action ?? "");

  const db = await getDb();
  const session = await db.query.mockSessions.findFirst({
    where: and(
      eq(mockSessions.id, sessionId),
      eq(mockSessions.userId, authResult.user.id),
    ),
  });
  if (!session || session.status !== "in_progress") {
    return Response.json({ error: "Sesi tidak valid" }, { status: 400 });
  }
  if (Date.now() > session.endsAt.getTime() + 5_000) {
    return Response.json(
      { error: "Waktu ujian telah habis" },
      { status: 409 },
    );
  }

  // Per-problem graded submit (ICPC-style penalty tracker)
  if (action === "submit_problem") {
    const mockMeta = await resolveMock(session.mockId);
    if (mockMeta?.penaltyEnabled === false) {
      return Response.json(
        { error: "Submission penalty tidak aktif untuk simulasi ini" },
        { status: 400 },
      );
    }
    const problemId = String(body.problemId ?? "");
    const problems = await resolveProblemsForMock(session.mockId);
    const problem = problems.find((p) => p.id === problemId);
    if (!problem) {
      return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
    }

    const answer = body.answer;
    // Server-side grading for codeSpec — never trust client codeResult.
    let codeSpecResult: CodeSpecRunResult | undefined;
    if (problem.answerType === "codeSpec" && problem.codeSpec) {
      const config = readJudge0Config();
      if (!config) {
        return Response.json(
          { error: "Penilaian coding belum disiapkan" },
          { status: 503 },
        );
      }
      const userCode = String(answer ?? "");
      if (!userCode.trim()) {
        return Response.json(
          { error: "Kode belum diisi" },
          { status: 400 },
        );
      }
      try {
        codeSpecResult = await gradeCodeWithJudge0({
          codeSpec: problem.codeSpec,
          userCode,
          config,
        });
      } catch (error) {
        if (error instanceof GraderUnavailableError) {
          return Response.json(
            { error: "Grader tidak tersedia" },
            { status: 502 },
          );
        }
        return Response.json(
          { error: "Gagal menilai kode" },
          { status: 500 },
        );
      }
    }

    const graded = scoreAnswer({
      answerType: problem.answerType,
      submitted: answer,
      expected: (problem.answer ?? "") as string | number | string[],
      tolerance: problem.tolerance,
      numericFormat: problem.numericFormat ?? problem.expectedFormat,
      legacy: problem.legacy,
      codeSpecResult,
    });

    // ICPC lock only on full solve
    const isCorrect = graded.correct === true;
    const minutesFromStart = Math.max(
      0,
      Math.floor((Date.now() - session.startedAt.getTime()) / 60_000),
    );
    const prevState = normalizePenaltyState(session.penaltyState);
    const recorded = recordSubmission({
      state: prevState,
      problemId,
      isCorrect,
      minutesFromStart,
      penaltyMinutesPerWrong:
        mockMeta?.penaltyMinutesPerWrong ?? DEFAULT_PENALTY_MINUTES_PER_WRONG,
    });

    if (!recorded.changed) {
      return Response.json({
        ok: true,
        alreadyLocked: true,
        correct: recorded.problem.solved,
        score: graded.score,
        codeSpecResult,
        formatHint:
          "formatHint" in graded
            ? (graded as { formatHint?: string }).formatHint
            : undefined,
        ...penaltySummaryPayload(recorded.state),
      });
    }

    const mergedAnswers = {
      ...((session.answers as Record<string, unknown>) ?? {}),
      [problemId]: answer,
    };

    await db.insert(submissionEvents).values({
      id: nanoid(),
      userId: authResult.user.id,
      mockSessionId: sessionId,
      problemId,
      kind: recorded.kind,
      correct: isCorrect,
    });

    const attempts = totalAttempts(recorded.state);
    const penaltyMinutes = totalPenaltyMinutes(recorded.state);

    await db
      .update(mockSessions)
      .set({
        answers: mergedAnswers,
        penaltyState: recorded.state,
        totalAttempts: attempts,
        penaltyMinutes,
        lastSubmitAt: new Date(),
      })
      .where(eq(mockSessions.id, sessionId));

    return Response.json({
      ok: true,
      correct: isCorrect,
      score: graded.score,
      locked: recorded.problem.solved,
      problemPenalty: recorded.problem,
      codeSpecResult,
      formatHint:
        "formatHint" in graded
          ? (graded as { formatHint?: string }).formatHint
          : undefined,
      ...penaltySummaryPayload(recorded.state),
    });
  }

  const hasAnswers = Object.prototype.hasOwnProperty.call(body, "answers");
  const answers = hasAnswers ? (body.answers ?? {}) : undefined;
  const integrityPayload =
    body.integrity && typeof body.integrity === "object"
      ? body.integrity
      : null;

  const patch: Record<string, unknown> = {};
  if (hasAnswers) {
    // Do not overwrite locked problem answers from autosave
    const penaltyState = normalizePenaltyState(session.penaltyState);
    const incoming = (answers ?? {}) as Record<string, unknown>;
    const current = (session.answers as Record<string, unknown>) ?? {};
    const merged: Record<string, unknown> = { ...current };
    for (const [pid, value] of Object.entries(incoming)) {
      if (penaltyState[pid]?.solved || penaltyState[pid]?.lockedAt) {
        continue;
      }
      merged[pid] = value;
    }
    patch.answers = merged;
  }

  let integrity = sessionIntegrity(session);
  if (integrityPayload) {
    integrity = mergeIntegrityUpdate(integrity, integrityPayload);
    Object.assign(patch, integrityColumns(integrity));
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({
      ok: true,
      integrity: integritySummary(integrity),
      ...penaltySummaryPayload(normalizePenaltyState(session.penaltyState)),
    });
  }

  await db
    .update(mockSessions)
    .set(patch)
    .where(eq(mockSessions.id, sessionId));

  return Response.json({
    ok: true,
    integrity: integritySummary(integrity),
    ...penaltySummaryPayload(normalizePenaltyState(session.penaltyState)),
  });
}

export async function PUT(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`mock-put:${authResult.user.id}`, 12, 60_000)) {
    return Response.json(
      { error: "Terlalu banyak percobaan. Coba lagi sebentar." },
      { status: 429 },
    );
  }
  const body = await req.json();
  const sessionId = String(body.sessionId ?? "");

  const db = await getDb();
  const session = await db.query.mockSessions.findFirst({
    where: and(
      eq(mockSessions.id, sessionId),
      eq(mockSessions.userId, authResult.user.id),
    ),
  });
  if (!session) {
    return Response.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
  }
  const problems = await resolveProblemsForMock(session.mockId);
  if (problems.length === 0) {
    return Response.json({ error: "Soal simulasi tidak ditemukan" }, { status: 404 });
  }
  const mockMeta = await resolveMock(session.mockId);
  const attemptSource = mockMeta?.source === "ai" ? "ai" : "curated";
  const withinGrace = Date.now() <= session.endsAt.getTime() + 5_000;
  const submittedAnswers =
    withinGrace && body.answers && typeof body.answers === "object"
      ? body.answers
      : session.answers;
  const answers = (submittedAnswers ?? {}) as Record<string, unknown>;
  const codeResultsRaw =
    body.codeResults && typeof body.codeResults === "object"
      ? (body.codeResults as Record<string, CodeSpecRunResult>)
      : {};

  let integrity = sessionIntegrity(session);
  if (body.integrity && typeof body.integrity === "object") {
    integrity = mergeIntegrityUpdate(integrity, body.integrity);
  }
  if (body.integrityForcedSubmit === true) {
    integrity = mergeIntegrityUpdate(integrity, {
      forcedSubmit: true,
      flagged: true,
      events: [
        {
          type: "forced_submit",
          at: new Date().toISOString(),
          detail: "integrity_forced",
        },
      ],
    });
  }

  const startedMs = session.startedAt.getTime();
  const rawElapsedMs = Math.max(0, Date.now() - startedMs);
  const plannedMs = session.endsAt.getTime() - startedMs;
  const fallbackCapMs = (mockMeta?.durationMinutes ?? 150) * 60_000;
  const capMs = plannedMs > 0 ? plannedMs : fallbackCapMs;
  const elapsedMs = Math.min(rawElapsedMs, capMs);
  const durationPerQuestion = Math.round(elapsedMs / problems.length);

  // Server-grade each codeSpec answer; ignore any client codeResults for coding.
  const config = readJudge0Config();
  const hasCodeSpecProblems = problems.some(
    (problem) => problem.answerType === "codeSpec" && problem.codeSpec,
  );
  if (hasCodeSpecProblems && !config) {
    return Response.json(
      { error: "Penilaian coding belum disiapkan" },
      { status: 503 },
    );
  }
  const serverCodeResults: Record<string, CodeSpecRunResult> = {};
  for (const p of problems) {
    if (p.answerType !== "codeSpec" || !p.codeSpec) continue;
    const userCode = String((answers as Record<string, unknown>)[p.id] ?? "");
    if (!userCode.trim()) {
      serverCodeResults[p.id] = {
        passedCount: 0,
        totalCount: p.codeSpec.testCases.length,
        passedWeight: 0,
        totalWeight: p.codeSpec.testCases.reduce(
          (sum, c) => sum + (c.weight ?? 1),
          0,
        ),
        timedOut: false,
        memoryExceeded: false,
        skeletonViolated: false,
      };
      continue;
    }
    if (!config) {
      return Response.json(
        { error: "Penilaian coding belum disiapkan" },
        { status: 503 },
      );
    }
    try {
      serverCodeResults[p.id] = await gradeCodeWithJudge0({
          codeSpec: p.codeSpec,
          userCode,
          config: config!,
      });
    } catch (error) {
      if (error instanceof GraderUnavailableError) {
        return Response.json(
          { error: "Grader tidak tersedia" },
          { status: 502 },
        );
      }
      return Response.json(
        { error: "Gagal menilai kode" },
        { status: 500 },
      );
    }
  }

  // Merge: server codeSpec overrides client codeResults for coding problems.
  const finalCodeResults: Record<string, CodeSpecRunResult> = {
    ...codeResultsRaw,
  };
  for (const [pid, res] of Object.entries(serverCodeResults)) {
    finalCodeResults[pid] = res;
  }

  const scored = scoreMockProblems({
    problems,
    answers,
    codeResults: finalCodeResults,
  });

  const penaltyState = normalizePenaltyState(session.penaltyState);
  const penaltyPayload = penaltySummaryPayload(penaltyState);

  if (session.status !== "submitted") {
    for (const p of problems) {
      const detail = scored.breakdown[p.id]!;
      const weight = defaultProblemWeight(p);
      await recordAttempt({
        userId: authResult.user.id,
        problemId: p.id,
        source: attemptSource,
        track: p.track,
        topic: p.topic,
        difficulty: p.difficulty,
        answerType: p.answerType,
        submittedAnswer: answers[p.id] ?? "",
        isCorrect: detail.correct,
        score: detail.weightedScore,
        maxScore: weight,
        durationMs: durationPerQuestion,
        mockSessionId: sessionId,
      });
    }

    await db
      .update(mockSessions)
      .set({
        status: "submitted",
        answers,
        score: scored.summary.earnedWeight,
        maxScore: scored.summary.totalWeight,
        scoreSummary: scored.summary,
        totalAttempts: penaltyPayload.totalAttempts,
        penaltyMinutes: penaltyPayload.penaltyMinutes,
        penaltyState,
        submittedAt: new Date(),
        ...integrityColumns(integrity),
      })
      .where(eq(mockSessions.id, sessionId));
  }

  return Response.json({
    score: scored.summary.earnedWeight,
    maxScore: scored.summary.totalWeight,
    percentage: scored.summary.percentage,
    correctCount: scored.correctCount,
    incorrectCount:
      problems.length - scored.correctCount - scored.unansweredCount,
    unansweredCount: scored.unansweredCount,
    elapsedMs,
    byTrack: scored.byTrack,
    byTopic: scored.byTopic,
    breakdown: scored.breakdown,
    summary: scored.summary,
    alreadySubmitted: session.status === "submitted",
    integrity: integritySummary(integrity),
    penaltyEnabled: mockMeta?.penaltyEnabled !== false,
    ...penaltyPayload,
  });
}
