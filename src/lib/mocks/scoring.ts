import type { Problem } from "@/lib/content/types";
import { defaultProblemWeight, isCodingProblem } from "@/lib/content/types";
import {
  scoreAnswer,
  type CodeSpecRunResult,
} from "@/lib/scoring/index";

export type MockScoreSummary = {
  earnedWeight: number;
  totalWeight: number;
  percentage: number;
  codingWeight: number;
  numericWeight: number;
  codingCount: number;
  numericCount: number;
  codingEarned: number;
  numericEarned: number;
};

export type ScoredProblemDetail = {
  correct: boolean;
  /** Fraction 0–1 before weight. */
  score: number;
  /** Weighted contribution (score × weight). */
  weightedScore: number;
  weight: number;
  expected: unknown;
  submitted: unknown;
  track: string;
  topic: string;
  isCoding: boolean;
  passedCount?: number;
  totalCount?: number;
};

export function scoreMockProblems(params: {
  problems: Problem[];
  answers: Record<string, unknown>;
  codeResults?: Record<string, CodeSpecRunResult | null | undefined>;
}): {
  summary: MockScoreSummary;
  breakdown: Record<string, ScoredProblemDetail>;
  byTrack: Record<string, { score: number; maxScore: number }>;
  byTopic: Record<string, { score: number; maxScore: number }>;
  correctCount: number;
  unansweredCount: number;
} {
  const { problems, answers, codeResults } = params;
  let earnedWeight = 0;
  let totalWeight = 0;
  let codingWeight = 0;
  let numericWeight = 0;
  let codingCount = 0;
  let numericCount = 0;
  let codingEarned = 0;
  let numericEarned = 0;
  let correctCount = 0;
  let unansweredCount = 0;

  const breakdown: Record<string, ScoredProblemDetail> = {};
  const byTrack: Record<string, { score: number; maxScore: number }> = {};
  const byTopic: Record<string, { score: number; maxScore: number }> = {};

  for (const p of problems) {
    const weight = defaultProblemWeight(p);
    const isCoding = isCodingProblem(p);

    totalWeight += weight;
    if (isCoding) {
      codingWeight += weight;
      codingCount += 1;
    } else {
      numericWeight += weight;
      numericCount += 1;
    }

    const submitted = answers[p.id];
    const unanswered =
      submitted === undefined ||
      submitted === null ||
      String(submitted).trim() === "";

    const r = scoreAnswer({
      answerType: p.answerType,
      submitted,
      expected: (p.answer ?? "") as string | number | string[],
      tolerance: p.tolerance,
      numericFormat: p.numericFormat ?? p.expectedFormat,
      legacy: p.legacy,
      codeSpecResult: codeResults?.[p.id],
    });

    const weightedScore = r.score * weight;
    earnedWeight += weightedScore;
    if (isCoding) codingEarned += weightedScore;
    else numericEarned += weightedScore;
    if (r.correct) correctCount += 1;
    if (unanswered) unansweredCount += 1;

    const codeResult = codeResults?.[p.id];
    breakdown[p.id] = {
      correct: r.correct,
      score: r.score,
      weightedScore,
      weight,
      expected:
        p.answerType === "codeSpec"
          ? `${codeResult?.passedCount ?? 0}/${codeResult?.totalCount ?? p.codeSpec?.testCases.length ?? 0} test case`
          : p.answer,
      submitted: submitted ?? "",
      track: p.track,
      topic: p.topic,
      isCoding,
      passedCount: codeResult?.passedCount,
      totalCount: codeResult?.totalCount ?? p.codeSpec?.testCases.length,
    };

    byTrack[p.track] ??= { score: 0, maxScore: 0 };
    byTrack[p.track].score += weightedScore;
    byTrack[p.track].maxScore += weight;
    byTopic[p.topic] ??= { score: 0, maxScore: 0 };
    byTopic[p.topic].score += weightedScore;
    byTopic[p.topic].maxScore += weight;
  }

  const percentage =
    totalWeight === 0
      ? 0
      : Math.round((earnedWeight / totalWeight) * 10000) / 100;

  return {
    summary: {
      earnedWeight,
      totalWeight,
      percentage,
      codingWeight,
      numericWeight,
      codingCount,
      numericCount,
      codingEarned,
      numericEarned,
    },
    breakdown,
    byTrack,
    byTopic,
    correctCount,
    unansweredCount,
  };
}
