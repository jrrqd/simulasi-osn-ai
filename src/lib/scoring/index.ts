import type {
  CheckQuestion,
  CodeSpecTestCase,
  NumericFormat,
} from "@/lib/content/types";
import { assertSkeletonUnlockedOnly } from "@/lib/ai/code-skeleton";

export function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/,/g, ".")
    .replace(/[‘’]/g, "'");
}

const VULGAR_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

/** Parse decimals, commas-as-dot, and simple fractions like 1/2 or -3/4. */
export function parseNumericInput(raw: string | number): number {
  if (typeof raw === "number") return raw;
  const normalized = normalizeText(String(raw));
  if (!normalized) return NaN;

  if (normalized in VULGAR_FRACTIONS) {
    return VULGAR_FRACTIONS[normalized]!;
  }

  // Allow spaces around slash: "1 / 2"
  const compact = normalized.replace(/\s+/g, "");
  const frac = compact.match(/^([+-]?\d*\.?\d+)\/([+-]?\d*\.?\d+)$/);
  if (frac) {
    const numerator = Number(frac[1]);
    const denominator = Number(frac[2]);
    if (
      !Number.isFinite(numerator) ||
      !Number.isFinite(denominator) ||
      denominator === 0
    ) {
      return NaN;
    }
    return numerator / denominator;
  }

  return Number(compact);
}

/** Strict token-level format check (OSN AI 2026). */
export function validateStrictFormat(
  format: NumericFormat,
  submitted: string,
): { ok: boolean; hint?: string } {
  const raw = String(submitted ?? "");
  // Reject leading/trailing whitespace mismatches for strict formats
  if (raw !== raw.trim()) {
    return {
      ok: false,
      hint: "Jangan pakai spasi di awal/akhir jawaban",
    };
  }

  switch (format) {
    case "integer": {
      if (!/^-?\d+$/.test(raw)) {
        return {
          ok: false,
          hint: 'Format integer: bilangan bulat saja (contoh "25", bukan "25.0")',
        };
      }
      return { ok: true };
    }
    case "decimal": {
      if (!/^-?\d+(\.\d+)?$/.test(raw)) {
        return {
          ok: false,
          hint: 'Format decimal: angka dengan titik (contoh "0.5" atau "3")',
        };
      }
      return { ok: true };
    }
    case "space_separated": {
      if (!raw || /\s{2,}/.test(raw) || raw !== raw.trim()) {
        return {
          ok: false,
          hint: 'Format space_separated: angka dipisah spasi tunggal (contoh "1 2 3")',
        };
      }
      const tokens = raw.split(" ");
      if (tokens.length < 2) {
        return {
          ok: false,
          hint: "Space-separated butuh minimal 2 angka",
        };
      }
      for (const t of tokens) {
        if (!/^-?\d+(\.\d+)?$/.test(t)) {
          return {
            ok: false,
            hint: `Token "${t}" bukan angka valid`,
          };
        }
      }
      return { ok: true };
    }
    case "comma_separated": {
      if (!raw || raw.includes(" ")) {
        return {
          ok: false,
          hint: 'Format comma_separated: angka dipisah koma tanpa spasi (contoh "1,2,3")',
        };
      }
      const tokens = raw.split(",");
      if (tokens.length < 2) {
        return {
          ok: false,
          hint: "Comma-separated butuh minimal 2 angka",
        };
      }
      for (const t of tokens) {
        if (!/^-?\d+(\.\d+)?$/.test(t)) {
          return {
            ok: false,
            hint: `Token "${t}" bukan angka valid`,
          };
        }
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

export function scoreNumeric(
  submitted: string | number,
  expected: number,
  tolerance = 1e-3,
) {
  const n = parseNumericInput(submitted);
  if (Number.isNaN(n)) return { correct: false, score: 0 };
  const ok =
    Math.abs(n - expected) <=
    Math.max(tolerance, Math.abs(expected) * tolerance);
  return { correct: ok, score: ok ? 1 : 0 };
}

/**
 * Strict numeric scoring when numericFormat is set.
 * Token-precise compare first; then numeric equality if format matches.
 */
export function scoreNumericStrict(params: {
  submitted: string | number;
  expected: string | number | string[];
  format: NumericFormat;
  tolerance?: number;
}): { correct: boolean; score: number; formatHint?: string } {
  const submitted = String(params.submitted ?? "");
  const formatCheck = validateStrictFormat(params.format, submitted);
  if (!formatCheck.ok) {
    return { correct: false, score: 0, formatHint: formatCheck.hint };
  }

  const expectedRaw = Array.isArray(params.expected)
    ? params.expected.map(String)
    : [String(params.expected)];

  // Exact string match against any expected alias (token-precise)
  if (expectedRaw.some((e) => e === submitted)) {
    return { correct: true, score: 1 };
  }

  if (
    params.format === "space_separated" ||
    params.format === "comma_separated"
  ) {
    const sep = params.format === "space_separated" ? " " : ",";
    const subTokens = submitted.split(sep);
    for (const exp of expectedRaw) {
      const formatOk = validateStrictFormat(params.format, exp);
      if (!formatOk.ok) continue;
      const expTokens = exp.split(sep);
      if (expTokens.length !== subTokens.length) continue;
      let allMatch = true;
      for (let i = 0; i < expTokens.length; i++) {
        const a = Number(subTokens[i]);
        const b = Number(expTokens[i]);
        if (!Number.isFinite(a) || !Number.isFinite(b) || a !== b) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) return { correct: true, score: 1 };
    }
    return { correct: false, score: 0 };
  }

  // integer / decimal: numeric compare but reject format mismatch already done
  const expectedNum =
    typeof params.expected === "number"
      ? params.expected
      : parseNumericInput(String(expectedRaw[0]));
  if (!Number.isFinite(expectedNum)) {
    return { correct: false, score: 0 };
  }

  // For integer format, require exact integer equality (no tolerance soft-pass of 25.0)
  if (params.format === "integer") {
    const n = Number(submitted);
    const ok = Number.isInteger(n) && n === expectedNum;
    return { correct: ok, score: ok ? 1 : 0 };
  }

  return scoreNumeric(submitted, expectedNum, params.tolerance ?? 0);
}

export function scoreShortString(
  submitted: string,
  expected: string | string[],
) {
  const s = normalizeText(submitted);
  const options = Array.isArray(expected) ? expected : [expected];
  const ok = options.some((o) => normalizeText(String(o)) === s);
  return { correct: ok, score: ok ? 1 : 0 };
}

/** Format hint for lesson check questions (OSN-aligned). */
export function validateCheckFormat(
  question: Pick<CheckQuestion, "answerType" | "numericFormat" | "answer">,
  submittedAnswer: string,
): { ok: boolean; hint?: string } {
  if (question.answerType !== "numeric") return { ok: true };
  if (question.numericFormat) {
    return validateStrictFormat(question.numericFormat, submittedAnswer);
  }
  // Soft path: must parse as a number (or match string expected)
  const n = parseNumericInput(submittedAnswer);
  if (!Number.isFinite(n) && String(question.answer).trim() !== "") {
    // Allow short exact string matches for legacy numeric answers like "P(A)P(B)"
    if (typeof question.answer === "string" && !/^-?\d/.test(question.answer)) {
      return { ok: true };
    }
    if (!Number.isFinite(n)) {
      return { ok: false, hint: "Jawaban harus berupa angka" };
    }
  }
  return { ok: true };
}

/** Score a lesson check-question (multi-format active recall). */
export function scoreCheckQuestion(
  question: CheckQuestion,
  submittedAnswer: unknown,
): { correct: boolean; score: number; formatHint?: string } {
  const submitted = String(submittedAnswer ?? "");
  const format = validateCheckFormat(question, submitted);
  if (!format.ok) {
    return { correct: false, score: 0, formatHint: format.hint };
  }

  if (question.answerType === "numeric") {
    if (question.numericFormat) {
      return scoreNumericStrict({
        submitted,
        expected: question.answer,
        format: question.numericFormat,
        tolerance: question.tolerance,
      });
    }
    // Legacy / free numeric: try numeric first, fall back to string
    const expectedNum =
      typeof question.answer === "number"
        ? question.answer
        : parseNumericInput(String(question.answer));
    if (Number.isFinite(expectedNum)) {
      return scoreNumeric(submitted, expectedNum, question.tolerance ?? 1e-3);
    }
    return scoreShortString(submitted, question.answer as string | string[]);
  }

  if (question.answerType === "mcq") {
    return scoreShortString(submitted, question.answer as string | string[]);
  }

  return scoreShortString(submitted, question.answer as string | string[]);
}

export type CodeSpecRunResult = {
  passedWeight: number;
  totalWeight: number;
  timedOut?: boolean;
  memoryExceeded?: boolean;
  skeletonViolated?: boolean;
  passedCount?: number;
  totalCount?: number;
};

/** Result from Kaggle-style competition CSV grading. */
export type CompetitionRunResult = {
  metricValue: number;
  score: number;
  metricLabel: string;
  log: string;
  summary?: string;
  rowCount: number;
  gradedBy?: "deterministic" | "llm_assisted";
};

/** Score from client-side test-case runner result (0–1 fraction). */
export function scoreCodeSpecResult(
  result: CodeSpecRunResult | null | undefined,
): { correct: boolean; score: number } {
  if (!result) return { correct: false, score: 0 };
  if (result.timedOut || result.memoryExceeded || result.skeletonViolated) {
    return { correct: false, score: 0 };
  }
  const total = result.totalWeight;
  if (!total || total <= 0) return { correct: false, score: 0 };
  const ratio = Math.max(0, Math.min(1, result.passedWeight / total));
  return { correct: ratio === 1, score: ratio };
}

export function scoreCompetitionResult(
  result: CompetitionRunResult | null | undefined,
): { correct: boolean; score: number } {
  if (!result) return { correct: false, score: 0 };
  const score = Math.max(0, Math.min(1, result.score));
  return { correct: score >= 0.999, score };
}

export function scoreAnswer(params: {
  answerType: string;
  submitted: unknown;
  expected: string | number | string[];
  tolerance?: number;
  numericFormat?: NumericFormat;
  /** Alias accepted for plan compatibility. */
  expectedFormat?: NumericFormat;
  legacy?: boolean;
  codeSpecResult?: CodeSpecRunResult | null;
  competitionResult?: CompetitionRunResult | null;
}) {
  const {
    answerType,
    submitted,
    expected,
    tolerance,
    legacy,
    codeSpecResult,
    competitionResult,
  } = params;
  const numericFormat = params.numericFormat ?? params.expectedFormat;

  if (answerType === "notebook_submission") {
    return scoreCompetitionResult(competitionResult);
  }

  if (answerType === "codeSpec") {
    return scoreCodeSpecResult(codeSpecResult);
  }

  if (answerType === "numeric") {
    if (numericFormat && !legacy) {
      return scoreNumericStrict({
        submitted: submitted as string | number,
        expected,
        format: numericFormat,
        tolerance,
      });
    }
    const expectedNum =
      typeof expected === "number"
        ? expected
        : parseNumericInput(String(expected));
    return scoreNumeric(
      submitted as string | number,
      expectedNum,
      tolerance,
    );
  }
  if (
    answerType === "mcq" ||
    answerType === "short_string" ||
    answerType === "python_output"
  ) {
    return scoreShortString(
      String(submitted ?? ""),
      expected as string | string[],
    );
  }
  if (answerType === "multi_part" && Array.isArray(expected)) {
    const parts = Array.isArray(submitted)
      ? submitted
      : String(submitted).split(/[;,|]/);
    if (parts.length !== expected.length) return { correct: false, score: 0 };
    let correct = 0;
    for (let i = 0; i < expected.length; i++) {
      const exp = expected[i];
      const sub = parts[i];
      if (
        typeof exp === "number" ||
        /^-?\d+(\.\d+)?$/.test(String(exp)) ||
        /^-?\d*\.?\d+\s*\/\s*-?\d*\.?\d+$/.test(String(exp))
      ) {
        const expectedNum =
          typeof exp === "number" ? exp : parseNumericInput(String(exp));
        const r = scoreNumeric(sub, expectedNum, tolerance);
        if (r.correct) correct += 1;
      } else {
        const r = scoreShortString(String(sub), String(exp));
        if (r.correct) correct += 1;
      }
    }
    const score = correct / expected.length;
    return { correct: score === 1, score };
  }
  return scoreShortString(
    String(submitted ?? ""),
    expected as string | string[],
  );
}

export function scoreProblemParts(
  parts: {
    id: string;
    answerType: string;
    answer: string | number | string[];
    tolerance?: number;
    points?: number;
  }[],
  submitted: Record<string, unknown>,
) {
  let earned = 0;
  let max = 0;
  const details: Record<string, { correct: boolean; score: number }> = {};
  for (const part of parts) {
    const points = part.points ?? 1;
    max += points;
    const result = scoreAnswer({
      answerType: part.answerType,
      submitted: submitted[part.id],
      expected: part.answer,
      tolerance: part.tolerance,
    });
    details[part.id] = result;
    earned += result.score * points;
  }
  return {
    correct: earned === max,
    score: max === 0 ? 0 : earned / max,
    earned,
    max,
    details,
  };
}

/** Normalize stdout for test-case comparison. */
export function normalizeStdout(raw: string): string {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n+$/g, "")
    .trimEnd();
}

export function compareStdout(actual: string, expected: string): boolean {
  return normalizeStdout(actual) === normalizeStdout(expected);
}

export function sumTestCaseWeights(cases: CodeSpecTestCase[]): number {
  return cases.reduce((sum, c) => sum + (c.weight ?? 1), 0);
}

export function validateUserCodeAgainstSkeleton(params: {
  skeleton: string;
  userCode: string;
  markers?: { open: string; close: string } | null;
}): { ok: boolean; error?: string } {
  return assertSkeletonUnlockedOnly(
    params.skeleton,
    params.userCode,
    params.markers,
  );
}
