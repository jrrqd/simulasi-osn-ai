import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api";
import { resolveProblem } from "@/lib/content/shared";
import { scoreAnswer, scoreProblemParts } from "@/lib/scoring";
import { recordAttempt } from "@/lib/attempts";
import { defaultProblemWeight } from "@/lib/content/types";
import type { CodeSpecRunResult } from "@/lib/scoring/index";

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;

  const body = await req.json();
  const problemId = String(body.problemId ?? "");
  const durationMs = Number(body.durationMs ?? 0);
  const submitted = body.answer;
  const codeSpecResult = body.codeSpecResult as CodeSpecRunResult | undefined;

  const problem = await resolveProblem(problemId);
  const source = problem?.source === "ai" || problemId.startsWith("ai-")
    ? "ai"
    : "curated";
  if (!problem) {
    return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
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
    formatHint:
      "formatHint" in result
        ? (result as { formatHint?: string }).formatHint
        : undefined,
  });
}
