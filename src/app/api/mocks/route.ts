import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { mockSessions } from "@/db/schema";
import { requireApiUser } from "@/lib/api";
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
import { scoreAnswer } from "@/lib/scoring";
import { recordAttempt } from "@/lib/attempts";

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

export async function GET(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  const mocks = await listAllMocks();
  return Response.json({ mocks });
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
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
    return Response.json({
      sessionId: existing.id,
      startedAt: existing.startedAt,
      endsAt: existing.endsAt,
      answers: existing.answers ?? {},
      resumed: true,
      integrity: integritySummary(integrity),
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
    ...integrityColumns(integrity),
  });

  return Response.json({
    sessionId: id,
    startedAt,
    endsAt,
    answers: {},
    resumed: false,
    integrity: integritySummary(integrity),
  });
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  const body = await req.json();
  const sessionId = String(body.sessionId ?? "");
  const hasAnswers = Object.prototype.hasOwnProperty.call(body, "answers");
  const answers = hasAnswers ? (body.answers ?? {}) : undefined;
  const integrityPayload =
    body.integrity && typeof body.integrity === "object"
      ? body.integrity
      : null;

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

  const patch: Record<string, unknown> = {};
  if (hasAnswers) {
    patch.answers = answers;
  }

  let integrity = sessionIntegrity(session);
  if (integrityPayload) {
    integrity = mergeIntegrityUpdate(integrity, integrityPayload);
    Object.assign(patch, integrityColumns(integrity));
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ ok: true, integrity: integritySummary(integrity) });
  }

  await db
    .update(mockSessions)
    .set(patch)
    .where(eq(mockSessions.id, sessionId));

  return Response.json({ ok: true, integrity: integritySummary(integrity) });
}

export async function PUT(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
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

  let earned = 0;
  let correctCount = 0;
  let unansweredCount = 0;
  const breakdown: Record<
    string,
    {
      correct: boolean;
      score: number;
      expected: unknown;
      submitted: unknown;
      track: string;
      topic: string;
    }
  > = {};
  const byTrack: Record<string, { score: number; maxScore: number }> = {};
  const byTopic: Record<string, { score: number; maxScore: number }> = {};

  // Use one clock for elapsed time. Cap by planned mock duration when endsAt
  // is valid; if endsAt is corrupt (e.g. tz mismatch), fall back to mock meta.
  const startedMs = session.startedAt.getTime();
  const rawElapsedMs = Math.max(0, Date.now() - startedMs);
  const plannedMs = session.endsAt.getTime() - startedMs;
  const fallbackCapMs = (mockMeta?.durationMinutes ?? 150) * 60_000;
  const capMs = plannedMs > 0 ? plannedMs : fallbackCapMs;
  const elapsedMs = Math.min(rawElapsedMs, capMs);
  const durationPerQuestion = Math.round(elapsedMs / problems.length);

  for (const p of problems) {
    const submitted = answers[p.id];
    const unanswered =
      submitted === undefined ||
      submitted === null ||
      String(submitted).trim() === "";
    const r = scoreAnswer({
      answerType: p.answerType,
      submitted,
      expected: p.answer as string | number | string[],
      tolerance: p.tolerance,
    });
    breakdown[p.id] = {
      correct: r.correct,
      score: r.score,
      expected: p.answer,
      submitted: submitted ?? "",
      track: p.track,
      topic: p.topic,
    };
    earned += r.score;
    if (r.correct) correctCount += 1;
    if (unanswered) unansweredCount += 1;
    byTrack[p.track] ??= { score: 0, maxScore: 0 };
    byTrack[p.track].score += r.score;
    byTrack[p.track].maxScore += 1;
    byTopic[p.topic] ??= { score: 0, maxScore: 0 };
    byTopic[p.topic].score += r.score;
    byTopic[p.topic].maxScore += 1;

    if (session.status !== "submitted") {
      await recordAttempt({
        userId: authResult.user.id,
        problemId: p.id,
        source: attemptSource,
        track: p.track,
        topic: p.topic,
        difficulty: p.difficulty,
        answerType: p.answerType,
        submittedAnswer: submitted ?? "",
        isCorrect: r.correct,
        score: r.score,
        maxScore: 1,
        durationMs: durationPerQuestion,
        mockSessionId: sessionId,
      });
    }
  }

  if (session.status !== "submitted") {
    await db
      .update(mockSessions)
      .set({
        status: "submitted",
        answers,
        score: earned,
        maxScore: problems.length,
        submittedAt: new Date(),
        ...integrityColumns(integrity),
      })
      .where(eq(mockSessions.id, sessionId));
  }

  return Response.json({
    score: earned,
    maxScore: problems.length,
    percentage: Math.round((earned / problems.length) * 10000) / 100,
    correctCount,
    incorrectCount: problems.length - correctCount - unansweredCount,
    unansweredCount,
    elapsedMs,
    byTrack,
    byTopic,
    breakdown,
    alreadySubmitted: session.status === "submitted",
    integrity: integritySummary(integrity),
  });
}
