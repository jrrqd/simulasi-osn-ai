import { NextRequest } from "next/server";
import { rateLimit, requireApiUser } from "@/lib/api";
import { resolveProblem } from "@/lib/content/shared";
import { scoreAnswer, scoreProblemParts } from "@/lib/scoring";
import { recordAttempt } from "@/lib/attempts";
import { defaultProblemWeight } from "@/lib/content/types";
import {
  GraderUnavailableError,
  gradeCodeWithJudge0,
  readJudge0Config,
} from "@/lib/grading/judge0";
import type { CodeSpecRunResult } from "@/lib/scoring/index";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`attempt:${authResult.user.id}`, 30, 60_000)) {
    return Response.json(
      { error: "Terlalu banyak percobaan. Coba lagi sebentar." },
      { status: 429 },
    );
  }

  const body = await req.json();
  const problemId = String(body.problemId ?? "");
  const durationMs = Number(body.durationMs ?? 0);
  const submitted = body.answer;
  // body.codeSpecResult intentionally ignored — codeSpec grading always
  // runs server-side from the submitted code so the client cannot tamper
  // with the score.

  const problem = await resolveProblem(problemId);
  const source = problem?.source === "ai" || problemId.startsWith("ai-")
    ? "ai"
    : "curated";
  if (!problem) {
    return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
  }

  let codeSpecResult: CodeSpecRunResult | undefined;
  if (problem.answerType === "codeSpec" && problem.codeSpec) {
    const config = readJudge0Config();
    if (!config) {
      return Response.json(
        { error: "Penilaian coding belum disiapkan" },
        { status: 503 },
      );
    }
    const userCode = String(submitted ?? "");
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

  const weight = defaultProblemWeight(problem);
  let result;
  if (problem.parts?.length) {
    result = scoreProblemParts(problem.parts, submitted ?? {});
  } else {
    const r = scoreAnswer({
      answerType: problem.answerType,
      submitted,
      expected: problem.answer as string | number | string[],
      tolerance: problem.tolerance,
      numericFormat: problem.numericFormat ?? problem.expectedFormat,
      expectedFormat: problem.expectedFormat,
      legacy: problem.legacy,
      codeSpecResult,
    });
    result = { ...r, earned: r.score * weight, max: weight, details: {} };
  }

  const attemptId = await recordAttempt({
    userId: authResult.user.id,
    problemId: problem.id,
    source,
    track: problem.track,
    topic: problem.topic,
    difficulty: problem.difficulty,
    answerType: problem.answerType,
    submittedAnswer: submitted,
    isCorrect: result.correct,
    score: result.earned ?? result.score * weight,
    maxScore: result.max ?? weight,
    durationMs,
  });

  return Response.json({
    attemptId,
    correct: result.correct,
    score: result.score,
    weightedScore: result.earned ?? result.score * weight,
    weight,
    details: result.details,
    solution: problem.solution,
    expected:
      problem.answerType === "codeSpec"
        ? codeSpecResult
          ? `${codeSpecResult.passedCount ?? 0}/${codeSpecResult.totalCount ?? 0} test case`
          : "test cases"
        : (problem.answer ?? problem.parts),
    codeSpecResult: problem.answerType === "codeSpec" ? codeSpecResult : undefined,
    formatHint:
      "formatHint" in result
        ? (result as { formatHint?: string }).formatHint
        : undefined,
  });
}
