export function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/,/g, ".")
    .replace(/[‘’]/g, "'");
}

export function scoreNumeric(
  submitted: string | number,
  expected: number,
  tolerance = 1e-3,
) {
  const n =
    typeof submitted === "number"
      ? submitted
      : Number(normalizeText(String(submitted)));
  if (Number.isNaN(n)) return { correct: false, score: 0 };
  const ok = Math.abs(n - expected) <= Math.max(tolerance, Math.abs(expected) * tolerance);
  return { correct: ok, score: ok ? 1 : 0 };
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

export function scoreAnswer(params: {
  answerType: string;
  submitted: unknown;
  expected: string | number | string[];
  tolerance?: number;
}) {
  const { answerType, submitted, expected, tolerance } = params;
  if (answerType === "numeric") {
    return scoreNumeric(submitted as string | number, Number(expected), tolerance);
  }
  if (answerType === "mcq" || answerType === "short_string" || answerType === "python_output") {
    return scoreShortString(String(submitted ?? ""), expected as string | string[]);
  }
  if (answerType === "multi_part" && Array.isArray(expected)) {
    const parts = Array.isArray(submitted) ? submitted : String(submitted).split(/[;,|]/);
    if (parts.length !== expected.length) return { correct: false, score: 0 };
    let correct = 0;
    for (let i = 0; i < expected.length; i++) {
      const exp = expected[i];
      const sub = parts[i];
      if (typeof exp === "number" || /^-?\d+(\.\d+)?$/.test(String(exp))) {
        const r = scoreNumeric(sub, Number(exp), tolerance);
        if (r.correct) correct += 1;
      } else {
        const r = scoreShortString(String(sub), String(exp));
        if (r.correct) correct += 1;
      }
    }
    const score = correct / expected.length;
    return { correct: score === 1, score };
  }
  return scoreShortString(String(submitted ?? ""), expected as string | string[]);
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
