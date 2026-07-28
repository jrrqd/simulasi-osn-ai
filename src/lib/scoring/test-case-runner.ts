/**
 * Pure helpers for multi test-case grading (OSN AI 2026).
 * Actual Pyodide execution lives in the browser (code-runner component);
 * this module scores / aggregates results and validates constraints.
 */

import type { CodeSpec, CodeSpecTestCase, Problem } from "@/lib/content/types";
import {
  compareStdout,
  scoreCodeSpecResult,
  sumTestCaseWeights,
  type CodeSpecRunResult,
  validateUserCodeAgainstSkeleton,
} from "@/lib/scoring/index";
import { resolveMarkers } from "@/lib/ai/code-skeleton";

export type TestCaseOutcome = {
  case: CodeSpecTestCase;
  index: number;
  passed: boolean;
  actualOutput: string;
  reason?: string;
};

export type RunCodeSpecAggregate = CodeSpecRunResult & {
  outcomes: TestCaseOutcome[];
};

/** Aggregate per-case outcomes into a CodeSpecRunResult. */
export function aggregateTestCaseOutcomes(params: {
  outcomes: TestCaseOutcome[];
  timedOut?: boolean;
  memoryExceeded?: boolean;
  skeletonViolated?: boolean;
}): RunCodeSpecAggregate {
  const { outcomes, timedOut, memoryExceeded, skeletonViolated } = params;
  let passedWeight = 0;
  let totalWeight = 0;
  let passedCount = 0;
  for (const o of outcomes) {
    const w = o.case.weight ?? 1;
    totalWeight += w;
    if (o.passed) {
      passedWeight += w;
      passedCount += 1;
    }
  }
  return {
    outcomes,
    passedWeight: timedOut || memoryExceeded || skeletonViolated ? 0 : passedWeight,
    totalWeight,
    timedOut: Boolean(timedOut),
    memoryExceeded: Boolean(memoryExceeded),
    skeletonViolated: Boolean(skeletonViolated),
    passedCount: timedOut || memoryExceeded || skeletonViolated ? 0 : passedCount,
    totalCount: outcomes.length,
  };
}

export function gradeCase(
  actualOutput: string,
  testCase: CodeSpecTestCase,
  index: number,
): TestCaseOutcome {
  const passed = compareStdout(actualOutput, testCase.expectedOutput);
  return {
    case: testCase,
    index,
    passed,
    actualOutput,
    reason: passed ? undefined : "Output tidak cocok",
  };
}

export function getCodeSpec(problem: Problem): CodeSpec | null {
  if (problem.codeSpec) return problem.codeSpec;
  return null;
}

export function validateCodeSpecShape(codeSpec: CodeSpec): {
  ok: boolean;
  error?: string;
} {
  if (!codeSpec.skeleton?.trim()) {
    return { ok: false, error: "codeSpec.skeleton wajib diisi" };
  }
  const markers = resolveMarkers(codeSpec.lockedMarkers);
  if (
    !codeSpec.skeleton.includes(markers.open) ||
    !codeSpec.skeleton.includes(markers.close)
  ) {
    return {
      ok: false,
      error: `Skeleton harus berisi "${markers.open}" dan "${markers.close}"`,
    };
  }
  if (!Array.isArray(codeSpec.testCases) || codeSpec.testCases.length < 3) {
    return { ok: false, error: "codeSpec.testCases wajib ≥ 3" };
  }
  for (let i = 0; i < codeSpec.testCases.length; i++) {
    const c = codeSpec.testCases[i]!;
    if (typeof c.expectedOutput !== "string") {
      return { ok: false, error: `testCases[${i}].expectedOutput wajib string` };
    }
  }
  if (
    !Number.isFinite(codeSpec.timeLimitMs) ||
    codeSpec.timeLimitMs < 500 ||
    codeSpec.timeLimitMs > 10_000
  ) {
    return {
      ok: false,
      error: "codeSpec.timeLimitMs harus antara 500–10000",
    };
  }
  if (
    !Number.isFinite(codeSpec.memoryLimitMb) ||
    codeSpec.memoryLimitMb < 64 ||
    codeSpec.memoryLimitMb > 1024
  ) {
    return {
      ok: false,
      error: "codeSpec.memoryLimitMb harus antara 64–1024",
    };
  }
  return { ok: true };
}

/**
 * Score a codeSpec problem given client-run results.
 * Also validates skeleton lock if userCode + skeleton provided.
 */
export function scoreCodeSpec(params: {
  problem: Problem;
  userCode?: string;
  runResult?: CodeSpecRunResult | null;
}): { correct: boolean; score: number; error?: string } {
  const spec = getCodeSpec(params.problem);
  if (!spec) {
    return { correct: false, score: 0, error: "Problem tidak punya codeSpec" };
  }

  if (params.userCode) {
    const lock = validateUserCodeAgainstSkeleton({
      skeleton: spec.skeleton,
      userCode: params.userCode,
      markers: spec.lockedMarkers,
    });
    if (!lock.ok) {
      return { correct: false, score: 0, error: lock.error };
    }
  }

  if (
    params.runResult?.timedOut ||
    params.runResult?.memoryExceeded ||
    params.runResult?.skeletonViolated
  ) {
    return { correct: false, score: 0 };
  }

  // If no run result, try to infer total weight for partial=0
  if (!params.runResult) {
    const total = sumTestCaseWeights(spec.testCases);
    return scoreCodeSpecResult({
      passedWeight: 0,
      totalWeight: total,
    });
  }

  return scoreCodeSpecResult(params.runResult);
}

export type { CodeSpecRunResult };
