import "server-only";

import { generateText } from "ai";
import { createUserProvider } from "@/lib/ai/provider";
import { parseJsonObject } from "@/lib/ai/parse-json-object";

/**
 * Use MiniMax (or user key) to recover a canonical submission CSV from a
 * messy notebook or oddly-named CSV. Never used as the metric scorer itself.
 */
export async function llmAssistCompetitionCsv(params: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  notebookJson?: string;
  submissionCsv?: string;
  expectedColumns: string[];
  idColumn: string;
  targetColumn: string;
}): Promise<{ csv: string; summary?: string } | null> {
  const model = createUserProvider({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    modelId: params.modelId,
    jsonOutput: false,
    disableThinking: true,
  });

  const notebookSnippet = params.notebookJson
    ? params.notebookJson.slice(0, 12_000)
    : "";
  const csvSnippet = params.submissionCsv
    ? params.submissionCsv.slice(0, 8_000)
    : "";

  const prompt = `Kamu membantu mengekstrak file submission kompetisi ML menjadi CSV kanonik.

Kolom wajib (urutan bebas): ${params.expectedColumns.join(", ")}
Kolom id: ${params.idColumn}
Kolom target/prediksi: ${params.targetColumn}

${csvSnippet ? `CSV yang diunggah siswa (mungkin salah nama kolom):\n\`\`\`\n${csvSnippet}\n\`\`\`\n` : ""}
${notebookSnippet ? `Cuplikan notebook .ipynb (JSON):\n\`\`\`\n${notebookSnippet}\n\`\`\`\n` : ""}

Tugas:
1. Temukan pasangan id → prediksi dari CSV atau output notebook.
2. Kembalikan SATU objek JSON: { "csv": "id,${params.targetColumn}\\n...", "summary": "satu kalimat" }.
3. csv harus header + baris data, tanpa markdown fence.
4. Jika tidak bisa mengekstrak prediksi yang valid, kembalikan { "csv": "", "summary": "alasan" }.

Balas HANYA JSON.`;

  const result = await generateText({
    model,
    prompt,
    maxOutputTokens: 4000,
  });

  const text = result.text?.trim() || "";
  if (!text) return null;

  let parsed: unknown;
  try {
    parsed = parseJsonObject(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const csv = String(obj.csv ?? "").trim();
  if (!csv || !csv.includes(",")) return null;
  return {
    csv,
    summary: obj.summary ? String(obj.summary) : undefined,
  };
}
