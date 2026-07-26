import type { GeneratedProblemPayload } from "@/lib/ai/provider";
import { parseNumericInput } from "@/lib/scoring";
import {
  alignChoiceToValue,
  formatNumericAnswer,
  solveKnownTemplates,
} from "@/lib/ai/verify-templates";

export type VerifyResult = {
  ok: boolean;
  payload: GeneratedProblemPayload;
  warnings: string[];
  error?: string;
};

/**
 * Structural + template verification before persisting AI problems.
 * When Bayes / GD / expectation / metrics patterns match, overwrite answer.
 */
export function verifyGeneratedProblem(
  payload: GeneratedProblemPayload,
  opts?: { styleTag?: string },
): VerifyResult {
  const warnings: string[] = [];
  const next: GeneratedProblemPayload = {
    ...payload,
    title: payload.title.trim(),
    stem: payload.stem.trim(),
    solution: payload.solution.trim(),
    tags: normalizeTags(payload.tags, opts?.styleTag),
  };

  if (next.title.length < 3) {
    return { ok: false, payload: next, warnings, error: "Judul terlalu pendek" };
  }
  if (next.stem.length < 10) {
    return { ok: false, payload: next, warnings, error: "Stem terlalu pendek" };
  }
  if (next.solution.length < 10) {
    return {
      ok: false,
      payload: next,
      warnings,
      error: "Solusi terlalu pendek",
    };
  }

  applyTemplateOverwrite(next, warnings);

  if (next.answerType === "mcq") {
    const choices = (next.choices ?? []).map(String).map((c) => c.trim());
    if (choices.length < 2) {
      return {
        ok: false,
        payload: next,
        warnings,
        error: "Soal MCQ harus punya minimal 2 choices",
      };
    }
    next.choices = choices;
    const answer = String(next.answer).trim();
    if (!choices.includes(answer)) {
      const soft = choices.find(
        (c) => normalizeChoice(c) === normalizeChoice(answer),
      );
      if (soft) {
        next.answer = soft;
        warnings.push("Jawaban MCQ dinormalisasi ke salinan choices");
      } else {
        return {
          ok: false,
          payload: next,
          warnings,
          error: "Jawaban MCQ harus salah satu choices",
        };
      }
    } else {
      next.answer = answer;
    }
  } else if (next.answerType === "numeric") {
    const n =
      typeof next.answer === "number"
        ? next.answer
        : parseNumericInput(String(next.answer));
    if (!Number.isFinite(n)) {
      return {
        ok: false,
        payload: next,
        warnings,
        error: "Jawaban numeric tidak valid",
      };
    }
    next.answer = n;
    if (next.tolerance == null) {
      next.tolerance = Number.isInteger(n) ? 0 : 0.001;
      warnings.push("Tolerance default ditambahkan untuk numeric");
    }
  } else if (
    next.answerType === "short_string" ||
    next.answerType === "python_output"
  ) {
    if (Array.isArray(next.answer)) {
      const cleaned = next.answer.map(String).map((s) => s.trim()).filter(Boolean);
      if (cleaned.length === 0) {
        return {
          ok: false,
          payload: next,
          warnings,
          error: "Jawaban short_string kosong",
        };
      }
      next.answer = cleaned;
    } else {
      const s = String(next.answer).trim();
      if (!s) {
        return {
          ok: false,
          payload: next,
          warnings,
          error: "Jawaban short_string kosong",
        };
      }
      next.answer = s;
      // Letter multi-select aliases: "a, c" → also accept "a,c"
      if (/^[a-d](\s*,\s*[a-d])+$/i.test(s)) {
        const compact = s.replace(/\s+/g, "");
        const spaced = compact.split(",").join(", ");
        if (compact !== s || spaced !== s) {
          next.answer = Array.from(new Set([s, compact, spaced]));
          warnings.push("Alias multi-pilih huruf ditambahkan");
        }
      }
    }
  }

  if (
    next.answerType === "numeric" &&
    typeof next.answer === "number" &&
    /tiga angka|3 desimal|3 angka/i.test(next.stem)
  ) {
    const rounded = Math.round(next.answer * 1000) / 1000;
    if (Math.abs(rounded - next.answer) > 1e-9) {
      next.answer = rounded;
      warnings.push("Jawaban dibulatkan ke 3 desimal sesuai stem");
    }
    if (next.tolerance == null || next.tolerance > 0.001) {
      next.tolerance = 0.001;
    }
  }

  return { ok: true, payload: next, warnings };
}

function applyTemplateOverwrite(
  next: GeneratedProblemPayload,
  warnings: string[],
) {
  if (
    next.answerType !== "numeric" &&
    next.answerType !== "mcq" &&
    next.answerType !== "short_string"
  ) {
    return;
  }

  const solved = solveKnownTemplates(next.stem);
  if (!solved.matched) return;

  const numericValue =
    typeof solved.value === "number"
      ? formatNumericAnswer(solved.value)
      : parseNumericInput(String(solved.value));

  if (!Number.isFinite(numericValue) && typeof solved.value !== "string") {
    return;
  }

  if (next.answerType === "mcq" && Number.isFinite(numericValue)) {
    const choices = (next.choices ?? []).map(String);
    const aligned = alignChoiceToValue(choices, numericValue);
    if (aligned) {
      if (String(next.answer).trim() !== aligned) {
        warnings.push(
          `Jawaban ${solved.kind} diverifikasi lokal → pilihan "${aligned}"`,
        );
      } else {
        warnings.push(`Jawaban ${solved.kind} cocok dengan verifikasi lokal`);
      }
      next.answer = aligned;
    } else {
      warnings.push(
        `Template ${solved.kind}=${numericValue} tidak cocok choices; jawaban model dipertahankan`,
      );
    }
    return;
  }

  if (next.answerType === "numeric" && Number.isFinite(numericValue)) {
    const prev =
      typeof next.answer === "number"
        ? next.answer
        : parseNumericInput(String(next.answer));
    next.answer = numericValue;
    if (!Number.isFinite(prev) || Math.abs(prev - numericValue) > 1e-6) {
      warnings.push(
        `Jawaban ${solved.kind} ditimpa verifikasi lokal (${numericValue})`,
      );
    } else {
      warnings.push(`Jawaban ${solved.kind} cocok dengan verifikasi lokal`);
    }
    if (next.tolerance == null) {
      next.tolerance = Number.isInteger(numericValue) ? 0 : 0.001;
    }
  }
}

function normalizeTags(tags: string[] | undefined, styleTag?: string) {
  const set = new Set((tags ?? []).map((t) => t.trim()).filter(Boolean));
  if (styleTag) set.add(styleTag);
  return set.size ? Array.from(set) : undefined;
}

function normalizeChoice(s: string) {
  return s.trim().toLowerCase().replace(/,/g, ".").replace(/\s+/g, "");
}
