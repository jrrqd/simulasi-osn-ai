import type { GeneratedProblemPayload } from "@/lib/ai/provider";
import {
  DEFAULT_WRITE_CLOSE,
  DEFAULT_WRITE_OPEN,
} from "@/lib/ai/code-skeleton";
import { parseNumericInput, validateStrictFormat } from "@/lib/scoring";
import { validateCodeSpecShape } from "@/lib/scoring/test-case-runner";
import {
  alignChoiceToValue,
  formatNumericAnswer,
  solveKnownTemplates,
} from "@/lib/ai/verify-templates";
import type { NumericFormat } from "@/lib/content/types";

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

  if (next.answerType === "codeSpec") {
    const codeSpec = next.codeSpec;
    if (!codeSpec) {
      return {
        ok: false,
        payload: next,
        warnings,
        error: "codeSpec wajib untuk answerType=codeSpec",
      };
    }
    // Ensure default markers
    codeSpec.lockedMarkers = codeSpec.lockedMarkers ?? {
      open: DEFAULT_WRITE_OPEN,
      close: DEFAULT_WRITE_CLOSE,
    };
    const shape = validateCodeSpecShape(codeSpec);
    if (!shape.ok) {
      return { ok: false, payload: next, warnings, error: shape.error };
    }
    next.codeSpec = codeSpec;
    next.starterCode = codeSpec.skeleton;
    next.weight = next.weight ?? 2;
    // Ensure answer is non-empty for schema consumers
    if (
      next.answer === undefined ||
      next.answer === null ||
      String(next.answer).trim() === ""
    ) {
      next.answer = codeSpec.testCases[0]?.expectedOutput ?? "ok";
    }
  } else if (next.answerType === "python_output") {
    const starter = next.starterCode?.trim();
    if (!starter) {
      return {
        ok: false,
        payload: next,
        warnings,
        error:
          "python_output wajib punya starterCode (runner in-exam; jangan minta siswa pindah tab)",
      };
    }
    next.starterCode = starter;
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
    next.weight = next.weight ?? 1;
  } else if (next.answerType === "numeric") {
    const inferred = inferNumericFormat(next);
    if (!next.numericFormat) {
      next.numericFormat = inferred.format;
      warnings.push(`numericFormat diisi otomatis: ${inferred.format}`);
    }

    // For space/comma lists, keep string answer
    if (
      next.numericFormat === "space_separated" ||
      next.numericFormat === "comma_separated"
    ) {
      const s = String(next.answer).trim();
      const check = validateStrictFormat(next.numericFormat, s);
      if (!check.ok) {
        // Try to coerce number arrays
        if (Array.isArray(next.answer)) {
          const sep =
            next.numericFormat === "space_separated" ? " " : ",";
          const joined = next.answer.map(String).join(sep);
          const check2 = validateStrictFormat(next.numericFormat, joined);
          if (!check2.ok) {
            return {
              ok: false,
              payload: next,
              warnings,
              error: check2.hint ?? "Jawaban multi-angka tidak valid",
            };
          }
          next.answer = joined;
        } else {
          return {
            ok: false,
            payload: next,
            warnings,
            error: check.hint ?? "Jawaban multi-angka tidak valid",
          };
        }
      } else {
        next.answer = s;
      }
    } else {
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
      // Store as string matching format for strict grading
      if (next.numericFormat === "integer") {
        next.answer = String(Math.round(n));
        next.tolerance = 0;
      } else {
        next.answer = n;
        if (next.tolerance == null) {
          next.tolerance = Number.isInteger(n) ? 0 : 0.001;
          warnings.push("Tolerance default ditambahkan untuk numeric");
        }
      }
    }
    next.weight = next.weight ?? 1;
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
    next.weight = next.weight ?? 1;
  }

  applyDecimalRoundingFromStem(next, warnings);

  return { ok: true, payload: next, warnings };
}

function inferNumericFormat(next: GeneratedProblemPayload): {
  format: NumericFormat;
} {
  const stem = next.stem;
  if (
    /bilangan bulat|integer|tanpa desimal|tanpa angka di belakang/i.test(stem)
  ) {
    return { format: "integer" };
  }
  if (
    /dipisah(?:kan)?\s+spasi|spasi tunggal|space[_\s-]?separated/i.test(stem)
  ) {
    return { format: "space_separated" };
  }
  if (/dipisah(?:kan)?\s+koma|comma[_\s-]?separated/i.test(stem)) {
    return { format: "comma_separated" };
  }
  if (
    /\b(\d+)\s*desimal\b|(\d+)\s*angka di belakang koma|satu angka di belakang koma|1 angka di belakang koma/i.test(
      stem,
    )
  ) {
    return { format: "decimal" };
  }
  // Infer from answer shape
  if (typeof next.answer === "number" && Number.isInteger(next.answer)) {
    return { format: "integer" };
  }
  const s = String(next.answer);
  if (/^-?\d+$/.test(s.trim())) return { format: "integer" };
  if (/\s/.test(s.trim()) && /^-?\d+(\.\d+)?(\s+-?\d+(\.\d+)?)+$/.test(s.trim())) {
    return { format: "space_separated" };
  }
  if (/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?)+$/.test(s.trim())) {
    return { format: "comma_separated" };
  }
  return { format: "decimal" };
}

function applyDecimalRoundingFromStem(
  next: GeneratedProblemPayload,
  warnings: string[],
) {
  if (next.answerType !== "numeric" || typeof next.answer !== "number") return;

  const m =
    next.stem.match(/\b(\d+)\s*desimal\b/i) ||
    next.stem.match(/(\d+)\s*angka di belakang koma/i) ||
    next.stem.match(/tiga angka|3 desimal|3 angka/i);
  if (!m) return;

  let places = 3;
  if (m[1]) places = Number(m[1]);
  else if (/tiga|3/.test(m[0])) places = 3;

  const factor = 10 ** places;
  const rounded = Math.round(next.answer * factor) / factor;
  if (Math.abs(rounded - next.answer) > 1e-9) {
    next.answer = rounded;
    warnings.push(`Jawaban dibulatkan ke ${places} desimal sesuai stem`);
  }
  if (next.tolerance == null || next.tolerance > 10 ** -places) {
    next.tolerance = 10 ** -places;
  }
  if (!next.numericFormat) next.numericFormat = "decimal";
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
