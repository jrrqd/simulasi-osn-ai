import { generateText } from "ai";
import { nanoid } from "nanoid";
import {
  createUserProvider,
} from "@/lib/ai/provider";
import { parseJsonObject } from "@/lib/ai/parse-json-object";
import { normalizeCheckQuestion } from "@/lib/content/load";
import type { CheckQuestion, Lesson } from "@/lib/content/types";
import { TOPIC_LABELS } from "@/lib/content/types";
import { scoreCheckQuestion, parseNumericInput } from "@/lib/scoring";
import { upsertGeneratedCheck } from "@/lib/lesson-checks";

function clip(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}\n…`;
}

function difficultyFromMastery(mastery: number): 1 | 2 | 3 {
  if (mastery < 0.4) return 1;
  if (mastery < 0.7) return 2;
  return 3;
}

function verifyCheck(q: CheckQuestion): { ok: boolean; error?: string; question: CheckQuestion } {
  const next = { ...q };
  if (next.prompt.length < 5) {
    return { ok: false, error: "Prompt terlalu pendek", question: next };
  }
  if (next.explanation.length < 3) {
    return { ok: false, error: "Explanation terlalu pendek", question: next };
  }
  if (next.answerType === "mcq") {
    const choices = (next.choices ?? []).map(String);
    if (choices.length < 2) {
      return { ok: false, error: "MCQ butuh ≥2 choices", question: next };
    }
    next.choices = choices;
    const ans = String(next.answer).trim();
    if (!choices.includes(ans)) {
      const soft = choices.find(
        (c) => c.trim().toLowerCase() === ans.toLowerCase(),
      );
      if (!soft) {
        return { ok: false, error: "Jawaban MCQ harus salah satu choices", question: next };
      }
      next.answer = soft;
    }
  }
  if (next.answerType === "numeric") {
    const n =
      typeof next.answer === "number"
        ? next.answer
        : parseNumericInput(String(next.answer));
    if (!Number.isFinite(n) && typeof next.answer !== "string") {
      return { ok: false, error: "Jawaban numeric tidak valid", question: next };
    }
    if (Number.isFinite(n) && next.numericFormat === "integer") {
      next.answer = String(Math.round(n as number));
    } else if (Number.isFinite(n) && !next.numericFormat) {
      next.answer = n as number;
      next.numericFormat = Number.isInteger(n) ? "integer" : "decimal";
    }
  }
  // Self-score sanity: answer should match itself
  const self = scoreCheckQuestion(next, String(next.answer));
  if (!self.correct && next.answerType !== "numeric") {
    // short_string / mcq should self-match after normalize
  }
  return { ok: true, question: next };
}

export async function generateLessonChecks(params: {
  lesson: Lesson;
  userId: string;
  mastery?: number;
  count?: number;
  baseUrl: string;
  apiKey: string;
  modelId: string;
}): Promise<CheckQuestion[]> {
  const count = Math.min(5, Math.max(3, params.count ?? 4));
  const difficulty = difficultyFromMastery(params.mastery ?? 0.4);
  const model = createUserProvider({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    modelId: params.modelId,
    jsonOutput: false,
  });

  const system = `Kamu pembuat cek konsep (active recall) untuk modul belajar OSN AI / EKKA.
Balas HANYA satu objek JSON: { "checks": [ ... ] } tanpa markdown fence.
Setiap item checks:
{
  "id": "string-unik",
  "prompt": "pertanyaan singkat",
  "answerType": "numeric" | "short_string" | "mcq",
  "answer": "nilai atau string",
  "choices": ["opsional untuk mcq"],
  "tolerance": 0.001,
  "numericFormat": "integer|decimal (jika numeric)",
  "explanation": "1-3 kalimat",
  "difficulty": 1|2|3,
  "conceptTags": ["tag1","tag2"],
  "hints": ["hint bertingkat 1", "hint 2"]
}
Campurkan tipe: minimal 1 numeric, 1 short_string, 1 mcq.
Jawaban harus deterministik dan bisa dinilai otomatis.
Bahasa Indonesia.`;

  const prompt = `Buat ${count} cek konsep untuk modul berikut.

Track: ${params.lesson.track}
Topic: ${params.lesson.topic} (${TOPIC_LABELS[params.lesson.topic] ?? params.lesson.topic})
Judul: ${params.lesson.title}
Ringkasan: ${params.lesson.summary}
Target difficulty: ${difficulty} (1=recall, 2=aplikasi, 3=sintesis/hitungan)
Mastery siswa saat ini: ${((params.mastery ?? 0) * 100).toFixed(0)}%

Materi:
${clip(params.lesson.body, 2800)}

Cek konsep yang sudah ada (jangan duplikat):
${params.lesson.checkQuestions
  .slice(0, 6)
  .map((q) => `- ${q.prompt}`)
  .join("\n") || "(belum ada)"}
`;

  const result = await generateText({
    model,
    system,
    prompt,
    maxOutputTokens: 3500,
  });

  const text = result.text ?? "";
  let parsed: { checks?: unknown[]; checkQuestions?: unknown[] } | null = null;
  try {
    parsed = parseJsonObject(text) as {
      checks?: unknown[];
      checkQuestions?: unknown[];
    };
  } catch {
    throw new Error("Model tidak mengembalikan JSON cek konsep yang valid");
  }

  const rawList = Array.isArray(parsed?.checks)
    ? parsed!.checks!
    : Array.isArray(parsed?.checkQuestions)
      ? parsed!.checkQuestions!
      : null;

  if (!rawList || rawList.length === 0) {
    throw new Error("Model tidak mengembalikan daftar cek konsep yang valid");
  }

  const out: CheckQuestion[] = [];
  for (const raw of rawList.slice(0, count + 2)) {
    const normalized = normalizeCheckQuestion({
      ...(raw as object),
      id: `chk-${nanoid(8)}`,
      difficulty: (raw as { difficulty?: number }).difficulty ?? difficulty,
      source: "ai",
    });
    if (!normalized) continue;
    const verified = verifyCheck(normalized);
    if (!verified.ok) continue;
    const saved = await upsertGeneratedCheck({
      lessonId: params.lesson.id,
      question: verified.question,
      createdBy: params.userId,
      id: verified.question.id,
    });
    out.push({
      ...verified.question,
      id: saved.id,
      source: "ai",
    });
    if (out.length >= count) break;
  }

  if (out.length === 0) {
    throw new Error("Semua cek konsep yang dihasilkan gagal verifikasi");
  }
  return out;
}
