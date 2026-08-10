import type { CompetitionSpec } from "@/lib/content/types";
import { extractSubmissionCsvFromNotebook } from "@/lib/notebook/build-starter-notebook";
import { parseCsv } from "@/lib/scoring/csv-parse";
import {
  gradeSubmissionCsv,
  scoringModeLabel,
} from "@/lib/scoring/submission-metrics";

export type SubmissionGradeResult = {
  metricValue: number;
  score: number;
  metricLabel: string;
  log: string;
  summary?: string;
  rowCount: number;
  errors?: string[];
  gradedBy: "deterministic" | "llm_assisted";
};

export type CompetitionGradeInput = {
  competition: CompetitionSpec;
  submissionCsv?: string | null;
  notebookJson?: string | null;
  /** Optional LLM helper to extract/normalize CSV when deterministic path fails. */
  llmAssist?: (params: {
    notebookJson?: string;
    submissionCsv?: string;
    expectedColumns: string[];
    idColumn: string;
    targetColumn: string;
  }) => Promise<{ csv: string; summary?: string } | null>;
};

/**
 * Orchestrate competition grading: deterministic metrics first;
 * LLM assist only to recover a usable CSV when needed.
 */
export async function gradeCompetitionSubmission(
  input: CompetitionGradeInput,
): Promise<SubmissionGradeResult> {
  const { competition } = input;
  const metricLabel = scoringModeLabel(
    competition.scoring.mode,
    competition.scoring.label,
  );
  const labelsCsv = competition.hiddenLabelsCsv?.trim();
  if (!labelsCsv) {
    return {
      metricValue: 0,
      score: 0,
      metricLabel,
      log: "Label tersembunyi tidak tersedia untuk penilaian.",
      rowCount: 0,
      errors: ["missing_hidden_labels"],
      gradedBy: "deterministic",
    };
  }

  let csv = input.submissionCsv?.trim() || null;
  let gradedBy: SubmissionGradeResult["gradedBy"] = "deterministic";
  let summary: string | undefined;

  if (!csv && input.notebookJson) {
    csv = extractSubmissionCsvFromNotebook(input.notebookJson);
  }

  // Try deterministic grade if we have CSV
  if (csv) {
    const result = gradeSubmissionCsv({
      submissionCsv: csv,
      labelsCsv,
      idColumn: competition.submission.idColumn,
      targetColumn: competition.submission.targetColumn,
      mode: competition.scoring.mode,
    });
    if (!result.errors?.length || result.rowCount > 0) {
      return {
        metricValue: result.metricValue,
        score: result.score,
        metricLabel,
        log: result.log,
        rowCount: result.rowCount,
        errors: result.errors,
        gradedBy,
      };
    }
  }

  // LLM assist for notebook / ambiguous CSV
  if (input.llmAssist) {
    try {
      const assisted = await input.llmAssist({
        notebookJson: input.notebookJson ?? undefined,
        submissionCsv: csv ?? undefined,
        expectedColumns: competition.submission.columns,
        idColumn: competition.submission.idColumn,
        targetColumn: competition.submission.targetColumn,
      });
      if (assisted?.csv?.trim()) {
        csv = assisted.csv.trim();
        gradedBy = "llm_assisted";
        summary = assisted.summary;
        const result = gradeSubmissionCsv({
          submissionCsv: csv,
          labelsCsv,
          idColumn: competition.submission.idColumn,
          targetColumn: competition.submission.targetColumn,
          mode: competition.scoring.mode,
        });
        return {
          metricValue: result.metricValue,
          score: result.score,
          metricLabel,
          log: result.log,
          summary,
          rowCount: result.rowCount,
          errors: result.errors,
          gradedBy,
        };
      }
    } catch (err) {
      return {
        metricValue: 0,
        score: 0,
        metricLabel,
        log: `Bantuan LLM gagal: ${err instanceof Error ? err.message : String(err)}. Unggah submission.csv langsung.`,
        rowCount: 0,
        errors: ["llm_assist_failed"],
        gradedBy: "llm_assisted",
      };
    }
  }

  return {
    metricValue: 0,
    score: 0,
    metricLabel,
    log: csv
      ? "Submission tidak bisa dinilai (kolom/id tidak cocok). Periksa sample_submission.csv."
      : "Tidak ada submission.csv yang bisa dibaca. Unggah CSV atau notebook dengan output submission.",
    rowCount: 0,
    errors: ["no_usable_submission"],
    gradedBy,
  };
}

/** Lightweight preview: columns + row count, no labels. */
export function previewCompetitionSubmission(params: {
  competition: CompetitionSpec;
  submissionCsv: string;
}): {
  ok: boolean;
  rowCount: number;
  headers: string[];
  warnings: string[];
} {
  const table = parseCsv(params.submissionCsv);
  const warnings: string[] = [];
  const { idColumn, targetColumn } = params.competition.submission;
  if (!table.headers.includes(idColumn)) {
    warnings.push(`Kolom id "${idColumn}" tidak ditemukan.`);
  }
  if (!table.headers.includes(targetColumn)) {
    warnings.push(`Kolom target "${targetColumn}" tidak ditemukan.`);
  }
  if (table.rows.length === 0) {
    warnings.push("Submission kosong.");
  }
  return {
    ok: warnings.length === 0,
    rowCount: table.rows.length,
    headers: table.headers,
    warnings,
  };
}
