import type { CompetitionSpec, Problem } from "@/lib/content/types";
import { scoringModeLabel } from "@/lib/scoring/submission-metrics";

type NbCell = {
  cell_type: "markdown" | "code";
  metadata: Record<string, unknown>;
  source: string[];
  outputs?: unknown[];
  execution_count?: number | null;
};

function lines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized.endsWith("\n")) {
    return (normalized + "\n").split(/(?<=\n)/);
  }
  return normalized.split(/(?<=\n)/);
}

function mdCell(text: string): NbCell {
  return { cell_type: "markdown", metadata: {}, source: lines(text) };
}

function codeCell(text: string): NbCell {
  return {
    cell_type: "code",
    metadata: {},
    source: lines(text),
    outputs: [],
    execution_count: null,
  };
}

/**
 * Build a nbformat v4 starter notebook for a Kaggle-style competition.
 * Template-based (not LLM-authored) for reliable JSON.
 */
export function buildStarterNotebook(params: {
  problem: Pick<Problem, "id" | "title" | "stem">;
  competition: CompetitionSpec;
  appUrl?: string;
}): string {
  const { problem, competition } = params;
  const metric = scoringModeLabel(
    competition.scoring.mode,
    competition.scoring.label,
  );
  const idCol = competition.submission.idColumn;
  const targetCol = competition.submission.targetColumn;
  const overviewExcerpt = competition.overview.slice(0, 2500);

  const cells: NbCell[] = [
    mdCell(
      `# ${problem.title}\n\n` +
        `Metrik penilaian: **${metric}** (\`${competition.scoring.mode}\`)\n\n` +
        (params.appUrl
          ? `Kembali ke platform: ${params.appUrl}\n\n`
          : "") +
        `Letakkan notebook ini di folder yang sama dengan \`train.csv\`, \`test.csv\`, dan \`sample_submission.csv\`.\n`,
    ),
    mdCell(`## Overview\n\n${overviewExcerpt}`),
    codeCell(
      `import pandas as pd\n` +
        `from pathlib import Path\n\n` +
        `DATA = Path(".")\n` +
        `train = pd.read_csv(DATA / "train.csv")\n` +
        `test = pd.read_csv(DATA / "test.csv")\n` +
        `sample = pd.read_csv(DATA / "sample_submission.csv")\n` +
        `print(train.shape, test.shape)\n` +
        `train.head()\n`,
    ),
    mdCell(
      "## Your work\n\nTulis pipeline fitur / model di sel berikutnya. " +
        "Jangan mengimpor modul di luar yang diizinkan panitia.",
    ),
    codeCell(`# >>> YOUR CODE HERE <<<\n\n`),
    mdCell(
      "## Buat submission.csv\n\n" +
        `Kolom wajib: \`${idCol}\`, \`${targetCol}\`. ` +
        "Unggah file ini di tab **Submit** di platform.",
    ),
    codeCell(
      `# >>> SUBMISSION CSV <<<\n` +
        `# Ganti prediksi di bawah dengan output model Anda.\n` +
        `submission = sample.copy()\n` +
        `# Contoh baseline: isi kolom target dengan nilai tetap / moda train\n` +
        `# submission["${targetCol}"] = ...\n\n` +
        `submission.to_csv("submission.csv", index=False)\n` +
        `print(submission.head())\n` +
        `print("Wrote submission.csv — upload on the Submit tab.")\n`,
    ),
    mdCell(
      "## Selesai?\n\n1. Pastikan `submission.csv` ada di folder yang sama.\n" +
        "2. Buka tab **Submit** di simulasi.\n" +
        "3. Lampirkan `submission.csv` (opsional: notebook ini) lalu klik **Submit untuk dinilai**.",
    ),
  ];

  const notebook = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3",
      },
      language_info: {
        name: "python",
        version: "3.11.0",
      },
      osnai: {
        problemId: problem.id,
        scoringMode: competition.scoring.mode,
      },
    },
    cells,
  };

  return JSON.stringify(notebook, null, 2);
}

/**
 * Try to extract a submission CSV from a student notebook.
 * Looks for a cell with marker `# >>> SUBMISSION CSV <<<` and nearby
 * printed CSV-like output, or a string literal that looks like CSV.
 */
export function extractSubmissionCsvFromNotebook(
  notebookJson: string,
): string | null {
  let nb: { cells?: Array<{ cell_type?: string; source?: string | string[]; outputs?: unknown[] }> };
  try {
    nb = JSON.parse(notebookJson);
  } catch {
    return null;
  }
  if (!Array.isArray(nb.cells)) return null;

  for (const cell of nb.cells) {
    const source = Array.isArray(cell.source)
      ? cell.source.join("")
      : String(cell.source ?? "");
    if (!source.includes(">>> SUBMISSION CSV <<<")) continue;

    // Prefer stdout from cell outputs that looks like CSV
    if (Array.isArray(cell.outputs)) {
      for (const out of cell.outputs) {
        if (!out || typeof out !== "object") continue;
        const o = out as Record<string, unknown>;
        const text =
          typeof o.text === "string"
            ? o.text
            : Array.isArray(o.text)
              ? o.text.join("")
              : typeof o.data === "object" &&
                  o.data &&
                  typeof (o.data as Record<string, unknown>)["text/plain"] ===
                    "string"
                ? String(
                    (o.data as Record<string, unknown>)["text/plain"],
                  )
                : "";
        if (looksLikeCsv(text)) return text.trim();
      }
    }
  }

  // Fallback: scan all outputs for CSV-shaped text
  for (const cell of nb.cells) {
    if (!Array.isArray(cell.outputs)) continue;
    for (const out of cell.outputs) {
      if (!out || typeof out !== "object") continue;
      const o = out as Record<string, unknown>;
      const text =
        typeof o.text === "string"
          ? o.text
          : Array.isArray(o.text)
            ? o.text.join("")
            : "";
      if (looksLikeCsv(text) && text.split("\n").length >= 3) {
        return text.trim();
      }
    }
  }

  return null;
}

function looksLikeCsv(text: string): boolean {
  const t = text.trim();
  if (!t.includes(",") || !t.includes("\n")) return false;
  const first = t.split(/\r?\n/)[0] ?? "";
  return first.split(",").length >= 2;
}
