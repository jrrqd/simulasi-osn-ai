import { createHmac, timingSafeEqual } from "node:crypto";
import type { CompetitionRunResult } from "@/lib/scoring/index";

type StampInput = {
  score: number;
  metricValue: number;
  metricLabel: string;
  rowCount: number;
  gradedBy?: CompetitionRunResult["gradedBy"];
};

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET missing");
  return value;
}

function canonical(problemId: string, input: StampInput) {
  return JSON.stringify({
    problemId,
    score: input.score,
    metricValue: input.metricValue,
    metricLabel: input.metricLabel,
    rowCount: input.rowCount,
    gradedBy: input.gradedBy ?? "deterministic",
  });
}

/** HMAC so a client cannot forge a competition score stored on a mock session. */
export function stampCompetitionAnswer(problemId: string, input: StampInput) {
  return createHmac("sha256", secret()).update(canonical(problemId, input)).digest("hex");
}

export function readStampedCompetitionResult(
  problemId: string,
  submitted: unknown,
): CompetitionRunResult | null {
  if (!submitted || typeof submitted !== "object") return null;
  const row = submitted as Record<string, unknown>;
  if (row.kind !== "competition_submission") return null;
  if (typeof row.score !== "number" || typeof row.stamp !== "string") return null;
  if (!process.env.BETTER_AUTH_SECRET) return null;

  const input: StampInput = {
    score: row.score,
    metricValue: Number(row.metricValue) || 0,
    metricLabel: String(row.metricLabel || "Metric"),
    rowCount: Number(row.rowCount) || 0,
    gradedBy: row.gradedBy === "llm_assisted" ? "llm_assisted" : "deterministic",
  };
  const expected = stampCompetitionAnswer(problemId, input);
  const given = Buffer.from(row.stamp);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  return {
    metricValue: input.metricValue,
    score: input.score,
    metricLabel: input.metricLabel,
    log: String(row.log || ""),
    summary: typeof row.summary === "string" ? row.summary : undefined,
    rowCount: input.rowCount,
    gradedBy: input.gradedBy,
  };
}
