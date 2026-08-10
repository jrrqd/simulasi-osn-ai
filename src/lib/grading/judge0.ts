import "server-only";

import type { CodeSpec } from "@/lib/content/types";
import {
  compareStdout,
  sumTestCaseWeights,
  type CodeSpecRunResult,
  validateUserCodeAgainstSkeleton,
} from "@/lib/scoring";

export type Judge0Config = {
  baseUrl: string;
  languageId: number;
  apiKey?: string;
  apiHost?: string;
};

export class GraderUnavailableError extends Error {
  constructor() {
    super("Layanan penilaian kode sedang tidak tersedia");
    this.name = "GraderUnavailableError";
  }
}

type Judge0Submission = {
  stdout?: string | null;
  status?: { id?: number; description?: string };
};

export function readJudge0Config(): Judge0Config | null {
  const baseUrl = process.env.JUDGE0_BASE_URL?.trim();
  const languageId = Number(process.env.JUDGE0_LANGUAGE_ID ?? 71);
  if (!baseUrl || !Number.isInteger(languageId)) return null;
  return {
    baseUrl,
    languageId,
    apiKey: process.env.JUDGE0_API_KEY?.trim() || undefined,
    apiHost: process.env.JUDGE0_API_HOST?.trim() || undefined,
  };
}

function configFromEnv(): Judge0Config {
  const config = readJudge0Config();
  if (!config) throw new GraderUnavailableError();
  return config;
}

function emptyResult(codeSpec: CodeSpec, skeletonViolated = false): CodeSpecRunResult {
  return {
    passedCount: 0,
    totalCount: codeSpec.testCases.length,
    passedWeight: 0,
    totalWeight: sumTestCaseWeights(codeSpec.testCases),
    timedOut: false,
    memoryExceeded: false,
    skeletonViolated,
  };
}

export async function gradeCodeWithJudge0(params: {
  codeSpec: CodeSpec;
  userCode: string;
  fetchImpl?: typeof fetch;
  config?: Judge0Config;
}): Promise<CodeSpecRunResult> {
  const { codeSpec, userCode } = params;
  const lock = validateUserCodeAgainstSkeleton({
    skeleton: codeSpec.skeleton,
    userCode,
    markers: codeSpec.lockedMarkers,
  });
  if (!lock.ok) return emptyResult(codeSpec, true);

  const config = params.config ?? configFromEnv();
  const fetchImpl = params.fetchImpl ?? fetch;
  const url = `${config.baseUrl.replace(/\/$/, "")}/submissions/batch?base64_encoded=false`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers["X-RapidAPI-Key"] = config.apiKey;
  if (config.apiHost) headers["X-RapidAPI-Host"] = config.apiHost;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        submissions: codeSpec.testCases.map((testCase) => ({
          source_code: userCode,
          language_id: config.languageId,
          stdin: testCase.input,
          cpu_time_limit: Math.max(0.1, codeSpec.timeLimitMs / 1000),
          memory_limit: codeSpec.memoryLimitMb * 1024,
        })),
      }),
      cache: "no-store",
    });
  } catch {
    throw new GraderUnavailableError();
  }

  if (!response.ok) throw new GraderUnavailableError();
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GraderUnavailableError();
  }

  if (Array.isArray(payload)) {
    const tokens = payload
      .map((item) => (item as { token?: unknown })?.token)
      .filter((token): token is string => typeof token === "string" && token.length > 0);
    if (tokens.length !== codeSpec.testCases.length) {
      throw new GraderUnavailableError();
    }
    try {
      const pollUrl = `${config.baseUrl.replace(/\/$/, "")}/submissions/batch?tokens=${encodeURIComponent(tokens.join(","))}&base64_encoded=false&fields=stdout,status`;
      const pollResponse = await fetchImpl(pollUrl, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      if (!pollResponse.ok) throw new GraderUnavailableError();
      payload = await pollResponse.json();
    } catch (error) {
      if (error instanceof GraderUnavailableError) throw error;
      throw new GraderUnavailableError();
    }
  }

  const submissions = (payload as { submissions?: unknown })?.submissions;
  if (!Array.isArray(submissions) || submissions.length !== codeSpec.testCases.length) {
    throw new GraderUnavailableError();
  }

  let passedCount = 0;
  let passedWeight = 0;
  let timedOut = false;
  let memoryExceeded = false;
  submissions.forEach((raw, index) => {
    const submission = raw as Judge0Submission;
    const statusId = submission.status?.id;
    const description = submission.status?.description?.toLowerCase() ?? "";
    if (statusId === 5 || description.includes("time limit")) timedOut = true;
    if (description.includes("memory")) memoryExceeded = true;
    if (
      statusId === 3 &&
      compareStdout(submission.stdout ?? "", codeSpec.testCases[index]!.expectedOutput)
    ) {
      passedCount += 1;
      passedWeight += codeSpec.testCases[index]!.weight ?? 1;
    }
  });

  return {
    passedCount: timedOut || memoryExceeded ? 0 : passedCount,
    totalCount: codeSpec.testCases.length,
    passedWeight: timedOut || memoryExceeded ? 0 : passedWeight,
    totalWeight: sumTestCaseWeights(codeSpec.testCases),
    timedOut,
    memoryExceeded,
    skeletonViolated: false,
  };
}
