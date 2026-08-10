import type {
  ClientCompetitionSpec,
  CompetitionSpec,
  SubmissionScoringMode,
} from "@/lib/content/types";
import { csvPreview, parseCsv } from "@/lib/scoring/csv-parse";

const SCORING_MODES: SubmissionScoringMode[] = [
  "accuracy",
  "f1_macro",
  "rmse",
  "mae",
];

export function isSubmissionScoringMode(
  value: unknown,
): value is SubmissionScoringMode {
  return (
    typeof value === "string" &&
    (SCORING_MODES as readonly string[]).includes(value)
  );
}

export function parseCompetitionSpec(raw: unknown): CompetitionSpec | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const overview = String(o.overview ?? "").trim();
  const scoringRaw =
    o.scoring && typeof o.scoring === "object"
      ? (o.scoring as Record<string, unknown>)
      : {};
  const mode = isSubmissionScoringMode(scoringRaw.mode)
    ? scoringRaw.mode
    : null;
  if (!overview || !mode) return null;

  const filesRaw = Array.isArray(o.files) ? o.files : [];
  const files = filesRaw
    .map((f) => {
      if (!f || typeof f !== "object") return null;
      const row = f as Record<string, unknown>;
      const name = String(row.name ?? "").trim();
      const content = String(row.content ?? "");
      if (!name || !content.trim()) return null;
      return {
        name,
        description: row.description
          ? String(row.description)
          : undefined,
        content,
      };
    })
    .filter((f): f is NonNullable<typeof f> => f != null);

  if (files.length === 0) return null;

  const subRaw =
    o.submission && typeof o.submission === "object"
      ? (o.submission as Record<string, unknown>)
      : {};
  const idColumn = String(subRaw.idColumn ?? "id").trim() || "id";
  const targetColumn =
    String(subRaw.targetColumn ?? "prediction").trim() || "prediction";
  const columns = Array.isArray(subRaw.columns)
    ? subRaw.columns.map(String).filter(Boolean)
    : [idColumn, targetColumn];

  const hiddenLabelsCsv =
    typeof o.hiddenLabelsCsv === "string" && o.hiddenLabelsCsv.trim()
      ? o.hiddenLabelsCsv
      : undefined;

  return {
    overview,
    scoring: {
      mode,
      label: scoringRaw.label ? String(scoringRaw.label) : undefined,
    },
    files,
    submission: { idColumn, targetColumn, columns },
    hiddenLabelsCsv,
  };
}

/** Validate competition CSVs are consistent enough to grade. */
export function validateCompetitionSpec(spec: CompetitionSpec): {
  ok: boolean;
  error?: string;
} {
  const test = spec.files.find((f) => /test\.csv$/i.test(f.name));
  const sample = spec.files.find((f) => /sample_submission\.csv$/i.test(f.name));
  const train = spec.files.find((f) => /train\.csv$/i.test(f.name));
  if (!test) return { ok: false, error: "competitionSpec butuh test.csv" };
  if (!sample) {
    return { ok: false, error: "competitionSpec butuh sample_submission.csv" };
  }
  if (!train) return { ok: false, error: "competitionSpec butuh train.csv" };
  if (!spec.hiddenLabelsCsv?.trim()) {
    return { ok: false, error: "competitionSpec butuh hiddenLabelsCsv" };
  }

  const testTable = parseCsv(test.content);
  const labels = parseCsv(spec.hiddenLabelsCsv);
  const { idColumn, targetColumn } = spec.submission;

  if (!testTable.headers.includes(idColumn)) {
    return { ok: false, error: `test.csv harus punya kolom ${idColumn}` };
  }
  if (!labels.headers.includes(idColumn) || !labels.headers.includes(targetColumn)) {
    return {
      ok: false,
      error: `hiddenLabelsCsv harus punya ${idColumn} dan ${targetColumn}`,
    };
  }
  if (labels.rows.length === 0) {
    return { ok: false, error: "hiddenLabelsCsv kosong" };
  }
  if (Math.abs(labels.rows.length - testTable.rows.length) > 0) {
    // Soft: allow if all test ids exist in labels
    const labelIds = new Set(labels.rows.map((r) => r[idColumn]));
    const missing = testTable.rows.filter((r) => !labelIds.has(r[idColumn]!));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `${missing.length} id di test.csv tidak ada di hiddenLabelsCsv`,
      };
    }
  }
  return { ok: true };
}

export function toClientCompetitionSpec(
  spec: CompetitionSpec,
): ClientCompetitionSpec {
  return {
    overview: spec.overview,
    scoring: spec.scoring,
    submission: spec.submission,
    files: spec.files.map((f) => {
      const { preview, rowCount } = csvPreview(f.content, 10);
      return {
        name: f.name,
        description: f.description,
        preview,
        rowCount,
      };
    }),
  };
}

export function getCompetitionFile(
  spec: CompetitionSpec,
  name: string,
): string | null {
  const file = spec.files.find(
    (f) => f.name.toLowerCase() === name.toLowerCase(),
  );
  return file?.content ?? null;
}
