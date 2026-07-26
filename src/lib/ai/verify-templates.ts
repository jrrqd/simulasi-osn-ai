import { parseNumericInput } from "@/lib/scoring";

/**
 * Lightweight local solvers for common hAIplay compute patterns.
 * When a pattern matches confidently, overwrite the model answer.
 */

export type TemplateSolve =
  | { matched: false }
  | {
      matched: true;
      value: number | string;
      kind: string;
      /** Prefer replacing numeric / aligning MCQ choice */
      preferNumeric: boolean;
    };

const NUM = String.raw`([+-]?\d+(?:[.,]\d+)?(?:\s*\/\s*[+-]?\d+(?:[.,]\d+)?)?)`;

function parseNum(raw: string): number {
  return parseNumericInput(raw.replace(/\s+/g, ""));
}

function nearEqual(a: number, b: number, tol = 1e-6) {
  return Math.abs(a - b) <= Math.max(tol, Math.abs(b) * 1e-6);
}

/** E = n · p  (ekspektasi jumlah hari / kejadian) */
function tryExpectation(stem: string): TemplateSolve {
  const nMatch = stem.match(
    new RegExp(
      `(?:selama|selama\\s+)?${NUM}\\s*(?:hari|kali|observasi|sampel|data)`,
      "i",
    ),
  );
  const pMatch =
    stem.match(new RegExp(`P\\s*\\([^)]+\\)\\s*=\\s*${NUM}`, "i")) ||
    stem.match(new RegExp(`peluang[^=]{0,40}=\\s*${NUM}`, "i"));
  if (!nMatch || !pMatch) return { matched: false };
  const n = parseNum(nMatch[1]!);
  const p = parseNum(pMatch[1]!);
  if (!Number.isFinite(n) || !Number.isFinite(p)) return { matched: false };
  if (!/ekspektasi|harapan|expected/i.test(stem)) return { matched: false };
  return {
    matched: true,
    value: n * p,
    kind: "expectation",
    preferNumeric: true,
  };
}

/**
 * Classic Bayes with two classes from stem like:
 * P(H)=…, P(M|H)=…, P(M|¬H)=…  → ask P(H|M) or P(¬H|M)
 */
function tryBayes(stem: string): TemplateSolve {
  const pH =
    stem.match(new RegExp(`P\\s*\\(\\s*H\\s*\\)\\s*=\\s*${NUM}`, "i")) ||
    stem.match(new RegExp(`P\\s*\\(\\s*hujan\\s*\\)\\s*=\\s*${NUM}`, "i"));
  const pMH = stem.match(
    new RegExp(`P\\s*\\(\\s*M\\s*\\|\\s*H\\s*\\)\\s*=\\s*${NUM}`, "i"),
  );
  const pMnotH =
    stem.match(
      new RegExp(
        `P\\s*\\(\\s*M\\s*\\|\\s*(?:\\\\neg\\s*H|¬H|~H|bukan\\s*H|\\\\neg\\{H\\})\\s*\\)\\s*=\\s*${NUM}`,
        "i",
      ),
    ) ||
    stem.match(
      new RegExp(`P\\s*\\(\\s*M\\s*\\|\\s*tidak\\s*hujan\\s*\\)\\s*=\\s*${NUM}`, "i"),
    );

  if (!pH || !pMH || !pMnotH) return { matched: false };

  const prior = parseNum(pH[1]!);
  const likH = parseNum(pMH[1]!);
  const likNot = parseNum(pMnotH[1]!);
  if (![prior, likH, likNot].every(Number.isFinite)) return { matched: false };

  const pM = likH * prior + likNot * (1 - prior);
  if (pM <= 0) return { matched: false };

  const asksNot =
    /P\s*\(\s*(?:\\neg\s*H|¬H|~H)\s*\|\s*M\s*\)|P\s*\(\s*tidak[^|]*\|\s*M/i.test(
      stem,
    ) || /bukan hujan.*diberi|posterior.*tidak/i.test(stem);
  const asksH =
    /P\s*\(\s*H\s*\|\s*M\s*\)/i.test(stem) ||
    /peluang.*hujan.*diberi|posterior.*hujan/i.test(stem);

  if (!asksH && !asksNot) return { matched: false };

  const postH = (likH * prior) / pM;
  const value = asksNot && !asksH ? 1 - postH : postH;
  return {
    matched: true,
    value,
    kind: "bayes",
    preferNumeric: true,
  };
}

/** One GD step: θ' = θ − η · g  when stem states θ, η, gradient clearly. */
function tryGradientDescentStep(stem: string): TemplateSolve {
  if (!/gradient|descen|satu langkah|satu iterasi|update\s*θ|θ\s*'/i.test(stem)) {
    return { matched: false };
  }
  const theta =
    stem.match(new RegExp(`θ\\s*=\\s*${NUM}`)) ||
    stem.match(new RegExp(`theta\\s*=\\s*${NUM}`, "i")) ||
    stem.match(new RegExp(`parameter\\s*=\\s*${NUM}`, "i"));
  const eta =
    stem.match(new RegExp(`η\\s*=\\s*${NUM}`)) ||
    stem.match(new RegExp(`eta\\s*=\\s*${NUM}`, "i")) ||
    stem.match(new RegExp(`learning\\s*rate\\s*=\\s*${NUM}`, "i")) ||
    stem.match(new RegExp(`laju\\s*belajar\\s*=\\s*${NUM}`, "i"));
  const grad =
    stem.match(new RegExp(`(?:gradien|gradient|∂L/∂θ|dL/dθ)\\s*=\\s*${NUM}`, "i")) ||
    stem.match(new RegExp(`g\\s*=\\s*${NUM}`));

  if (!theta || !eta || !grad) return { matched: false };
  const t = parseNum(theta[1]!);
  const e = parseNum(eta[1]!);
  const g = parseNum(grad[1]!);
  if (![t, e, g].every(Number.isFinite)) return { matched: false };
  return {
    matched: true,
    value: t - e * g,
    kind: "gd-step",
    preferNumeric: true,
  };
}

/** Linear prediction y = a·x + b·z + c (or similar) when coefficients + inputs given. */
function tryLinearPrediction(stem: string): TemplateSolve {
  if (!/prediksi|hitung.*nilai|nilai model/i.test(stem)) {
    return { matched: false };
  }
  // prediksi = 0,2·jarak + 0,5·berat + 0,4
  const formula = stem.match(
    /prediksi\s*=\s*([^\n]+?)(?:\n|\.|$)/i,
  );
  if (!formula) return { matched: false };
  const expr = formula[1]!;
  // Collect terms: coef · name or bare constant
  const terms = [
    ...expr.matchAll(
      new RegExp(`${NUM}\\s*[·*]\\s*([a-zA-Z_][\\w]*)`, "g"),
    ),
  ];
  const constantMatches = [
    ...expr.matchAll(new RegExp(`(?:^|[+＋]\\s*)${NUM}(?!\\s*[·*])`, "g")),
  ];
  if (terms.length === 0) return { matched: false };

  let sum = 0;
  for (const m of terms) {
    const coef = parseNum(m[1]!);
    const name = m[2]!;
    const valMatch =
      stem.match(
        new RegExp(`${name}\\s*(?:=|adalah|:)?\\s*${NUM}`, "i"),
      ) ||
      stem.match(
        new RegExp(`(?:untuk|dengan)\\s+[^\\n]{0,40}${name}\\s+${NUM}`, "i"),
      );
    if (!valMatch) return { matched: false };
    const v = parseNum(valMatch[1]!);
    if (!Number.isFinite(coef) || !Number.isFinite(v)) return { matched: false };
    sum += coef * v;
  }
  for (const m of constantMatches) {
    const c = parseNum(m[1]!);
    if (Number.isFinite(c)) sum += c;
  }
  return {
    matched: true,
    value: sum,
    kind: "linear-pred",
    preferNumeric: true,
  };
}

/** Precision / recall / F1 from TP,FP,FN when all three present. */
function tryClassificationMetrics(stem: string): TemplateSolve {
  const tp = stem.match(new RegExp(`\\bTP\\s*=\\s*${NUM}`, "i"));
  const fp = stem.match(new RegExp(`\\bFP\\s*=\\s*${NUM}`, "i"));
  const fn = stem.match(new RegExp(`\\bFN\\s*=\\s*${NUM}`, "i"));
  if (!tp || !fp) return { matched: false };
  const TP = parseNum(tp[1]!);
  const FP = parseNum(fp[1]!);
  const FN = fn ? parseNum(fn[1]!) : NaN;
  if (![TP, FP].every(Number.isFinite)) return { matched: false };

  if (/\bprecision\b|presisi/i.test(stem) && TP + FP > 0) {
    return {
      matched: true,
      value: TP / (TP + FP),
      kind: "precision",
      preferNumeric: true,
    };
  }
  if (/\brecall\b|sensitivitas/i.test(stem) && Number.isFinite(FN) && TP + FN > 0) {
    return {
      matched: true,
      value: TP / (TP + FN),
      kind: "recall",
      preferNumeric: true,
    };
  }
  if (/\bf1\b|f-?score/i.test(stem) && Number.isFinite(FN) && TP + FP > 0 && TP + FN > 0) {
    const prec = TP / (TP + FP);
    const rec = TP / (TP + FN);
    if (prec + rec === 0) return { matched: false };
    return {
      matched: true,
      value: (2 * prec * rec) / (prec + rec),
      kind: "f1",
      preferNumeric: true,
    };
  }
  return { matched: false };
}

export function solveKnownTemplates(stem: string): TemplateSolve {
  const text = stem.replace(/\u00a0/g, " ");
  const solvers = [
    tryBayes,
    tryGradientDescentStep,
    tryExpectation,
    tryClassificationMetrics,
    tryLinearPrediction,
  ];
  for (const solve of solvers) {
    const r = solve(text);
    if (r.matched) return r;
  }
  return { matched: false };
}

/** Pick MCQ choice closest to computed value (fraction-aware). */
export function alignChoiceToValue(
  choices: string[],
  value: number,
): string | null {
  let best: { choice: string; dist: number } | null = null;
  for (const choice of choices) {
    const n = parseNumericInput(choice);
    if (!Number.isFinite(n)) continue;
    const dist = Math.abs(n - value);
    if (!best || dist < best.dist) best = { choice, dist };
  }
  if (!best) return null;
  // Require close match — don't overwrite if model choices are unrelated
  if (best.dist > Math.max(0.02, Math.abs(value) * 0.02) && !nearEqual(best.dist, 0, 1e-9)) {
    // Still accept if within 1e-3 absolute for contest fractions
    if (best.dist > 1e-3) return null;
  }
  return best.choice;
}

export function formatNumericAnswer(value: number): number {
  if (Number.isInteger(value) || nearEqual(value, Math.round(value))) {
    return Math.round(value);
  }
  // Keep up to 6 significant decimals without trailing noise
  return Math.round(value * 1e6) / 1e6;
}
