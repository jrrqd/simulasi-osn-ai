import type { SubmissionScoringMode } from "@/lib/content/types";
import { parseCsv } from "@/lib/scoring/csv-parse";

export type SubmissionMetricResult = {
  /** Same as score for accuracy/f1; for error metrics this is the 0–1 credit. */
  score: number;
  /** Raw metric value (accuracy/F1 in [0,1]; RMSE/MAE as absolute error). */
  metricValue: number;
  log: string;
};

const DEFAULT_LABELS: Record<SubmissionScoringMode, string> = {
  accuracy: "Accuracy",
  f1_macro: "Macro F1",
  rmse: "RMSE",
  mae: "MAE",
};

export function scoringModeLabel(
  mode: SubmissionScoringMode,
  label?: string,
): string {
  return label?.trim() || DEFAULT_LABELS[mode];
}

/**
 * Align prediction rows with label rows by id column.
 * Returns null if ids cannot be matched 1:1.
 */
export function alignById(params: {
  predictions: Record<string, string>[];
  labels: Record<string, string>[];
  idColumn: string;
  targetColumn: string;
}): {
  pred: string[];
  truth: string[];
  matched: number;
  missingIds: string[];
} | null {
  const { predictions, labels, idColumn, targetColumn } = params;
  if (!predictions.length || !labels.length) return null;

  const predMap = new Map<string, string>();
  for (const row of predictions) {
    const id = String(row[idColumn] ?? "").trim();
    if (!id) continue;
    predMap.set(id, String(row[targetColumn] ?? "").trim());
  }

  const pred: string[] = [];
  const truth: string[] = [];
  const missingIds: string[] = [];

  for (const row of labels) {
    const id = String(row[idColumn] ?? "").trim();
    if (!id) continue;
    const t = String(row[targetColumn] ?? "").trim();
    const p = predMap.get(id);
    if (p == null) {
      missingIds.push(id);
      continue;
    }
    pred.push(p);
    truth.push(t);
  }

  if (pred.length === 0) return null;
  return { pred, truth, matched: pred.length, missingIds };
}

export function computeAccuracy(pred: string[], truth: string[]): number {
  if (pred.length === 0 || pred.length !== truth.length) return 0;
  let correct = 0;
  for (let i = 0; i < pred.length; i++) {
    if (normalizeToken(pred[i]!) === normalizeToken(truth[i]!)) correct += 1;
  }
  return correct / pred.length;
}

export function computeF1Macro(pred: string[], truth: string[]): number {
  if (pred.length === 0 || pred.length !== truth.length) return 0;
  const labels = new Set<string>();
  for (let i = 0; i < truth.length; i++) {
    labels.add(normalizeToken(truth[i]!));
    labels.add(normalizeToken(pred[i]!));
  }
  if (labels.size === 0) return 0;

  let sum = 0;
  let counted = 0;
  for (const label of labels) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (let i = 0; i < truth.length; i++) {
      const p = normalizeToken(pred[i]!);
      const t = normalizeToken(truth[i]!);
      if (p === label && t === label) tp += 1;
      else if (p === label && t !== label) fp += 1;
      else if (p !== label && t === label) fn += 1;
    }
    if (tp + fp + fn === 0) continue;
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 =
      precision + recall === 0
        ? 0
        : (2 * precision * recall) / (precision + recall);
    sum += f1;
    counted += 1;
  }
  return counted === 0 ? 0 : sum / counted;
}

export function computeRmse(pred: string[], truth: string[]): number | null {
  const pairs = parseNumericPairs(pred, truth);
  if (!pairs) return null;
  let sumSq = 0;
  for (const [p, t] of pairs) {
    const d = p - t;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / pairs.length);
}

export function computeMae(pred: string[], truth: string[]): number | null {
  const pairs = parseNumericPairs(pred, truth);
  if (!pairs) return null;
  let sum = 0;
  for (const [p, t] of pairs) sum += Math.abs(p - t);
  return sum / pairs.length;
}

/**
 * Convert absolute error metrics into proportional credit in [0, 1].
 * Uses 1 / (1 + error) so perfect predictions score 1 and large errors → 0.
 */
export function errorToScore(error: number): number {
  if (!Number.isFinite(error) || error < 0) return 0;
  return 1 / (1 + error);
}

function parseNumericPairs(
  pred: string[],
  truth: string[],
): Array<[number, number]> | null {
  if (pred.length === 0 || pred.length !== truth.length) return null;
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < pred.length; i++) {
    const p = Number(String(pred[i]).replace(",", "."));
    const t = Number(String(truth[i]).replace(",", "."));
    if (!Number.isFinite(p) || !Number.isFinite(t)) return null;
    pairs.push([p, t]);
  }
  return pairs;
}

function normalizeToken(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Grade aligned prediction/label vectors for a scoring mode.
 * Returns proportional score in [0, 1] for all modes.
 */
export function computeSubmissionMetric(
  mode: SubmissionScoringMode,
  pred: string[],
  truth: string[],
): SubmissionMetricResult {
  if (pred.length === 0 || pred.length !== truth.length) {
    return {
      score: 0,
      metricValue: 0,
      log: "Tidak ada baris yang bisa disejajarkan untuk penilaian.",
    };
  }

  if (mode === "accuracy") {
    const value = computeAccuracy(pred, truth);
    return {
      score: value,
      metricValue: value,
      log: `Accuracy = ${value.toFixed(4)} (${Math.round(value * pred.length)}/${pred.length} benar)`,
    };
  }

  if (mode === "f1_macro") {
    const value = computeF1Macro(pred, truth);
    return {
      score: value,
      metricValue: value,
      log: `Macro F1 = ${value.toFixed(4)} atas ${pred.length} baris`,
    };
  }

  if (mode === "rmse") {
    const err = computeRmse(pred, truth);
    if (err == null) {
      return {
        score: 0,
        metricValue: 0,
        log: "RMSE gagal: prediksi/label harus numerik.",
      };
    }
    const score = errorToScore(err);
    return {
      score,
      metricValue: err,
      log: `RMSE = ${err.toFixed(4)} → skor proporsional ${score.toFixed(4)}`,
    };
  }

  // mae
  const err = computeMae(pred, truth);
  if (err == null) {
    return {
      score: 0,
      metricValue: 0,
      log: "MAE gagal: prediksi/label harus numerik.",
    };
  }
  const score = errorToScore(err);
  return {
    score,
    metricValue: err,
    log: `MAE = ${err.toFixed(4)} → skor proporsional ${score.toFixed(4)}`,
  };
}

export function gradeSubmissionCsv(params: {
  submissionCsv: string;
  labelsCsv: string;
  idColumn: string;
  targetColumn: string;
  mode: SubmissionScoringMode;
}): SubmissionMetricResult & {
  rowCount: number;
  errors?: string[];
} {
  const submission = parseCsv(params.submissionCsv);
  const labels = parseCsv(params.labelsCsv);
  const errors: string[] = [];

  if (!submission.headers.includes(params.idColumn)) {
    errors.push(`Kolom id "${params.idColumn}" tidak ada di submission.`);
  }
  if (!submission.headers.includes(params.targetColumn)) {
    errors.push(
      `Kolom target "${params.targetColumn}" tidak ada di submission.`,
    );
  }
  if (errors.length > 0) {
    return {
      score: 0,
      metricValue: 0,
      log: errors.join(" "),
      rowCount: 0,
      errors,
    };
  }

  const aligned = alignById({
    predictions: submission.rows,
    labels: labels.rows,
    idColumn: params.idColumn,
    targetColumn: params.targetColumn,
  });

  if (!aligned) {
    return {
      score: 0,
      metricValue: 0,
      log: "Gagal menyejajarkan submission dengan label tersembunyi.",
      rowCount: 0,
      errors: ["Tidak ada id yang cocok."],
    };
  }

  if (aligned.missingIds.length > 0) {
    errors.push(
      `${aligned.missingIds.length} id label tidak ditemukan di submission (contoh: ${aligned.missingIds.slice(0, 3).join(", ")}).`,
    );
  }

  const metric = computeSubmissionMetric(
    params.mode,
    aligned.pred,
    aligned.truth,
  );
  return {
    ...metric,
    log:
      aligned.missingIds.length > 0
        ? `${metric.log} · ${errors.join(" ")}`
        : metric.log,
    rowCount: aligned.matched,
    errors: errors.length > 0 ? errors : undefined,
  };
}
