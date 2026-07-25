import { streamText } from "ai";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { generatedProblems } from "@/db/schema";
import {
  GENERATION_SYSTEM_PROMPT,
  createUserProvider,
  generatedProblemSchema,
  normalizeGeneratedProblem,
  type GeneratedProblemPayload,
} from "@/lib/ai/provider";
import {
  type DifficultyMode,
  resolveDifficulty,
} from "@/lib/ai/difficulty";
import type { GenerationProgressHandler } from "@/lib/ai/generation-progress";
import { parseGeneratedProblemJson } from "@/lib/ai/parse-json-object";
import { getLessonsForTopic } from "@/lib/content/load";
import type { Lesson } from "@/lib/content/types";
import {
  TRACKS,
  TOPIC_LABELS,
  type Problem,
  type TrackId,
} from "@/lib/content/types";

// Keep wall-clock per request under nginx /api/ai/ proxy_read_timeout (300s).
// Thinking models may spend many tokens on reasoning before the JSON answer,
// so leave more output budget than a plain chat completion would need.
const MAX_GENERATION_ATTEMPTS = 3;
const MAX_OUTPUT_TOKENS = 4500;
const GENERATION_ATTEMPT_TIMEOUT_MS = 75_000;
const THINKING_EMIT_MS = 160;

export type { DifficultyMode } from "@/lib/ai/difficulty";
export {
  DIFFICULTY_MODES,
  parseDifficultyMode,
  resolveDifficulty,
  labelDifficultyMode,
} from "@/lib/ai/difficulty";

const ANSWER_TYPES = [
  "numeric",
  "short_string",
  "mcq",
  "python_output",
] as const;

const MAX_LESSON_BODY_CHARS = 2200;
const MAX_LESSONS_IN_PROMPT = 2;

function clip(text: string, max: number) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}\n…`;
}

function buildSyllabusContext(track: TrackId, topic: string): string {
  const trackMeta = TRACKS[track];
  const lessons = getLessonsForTopic(track, topic).slice(0, MAX_LESSONS_IN_PROMPT);

  const allowedTopics = trackMeta.topics
    .map((t) => `- ${t} (${TOPIC_LABELS[t] ?? t})`)
    .join("\n");

  if (lessons.length === 0) {
    return `## Cakupan track ${track} (${trackMeta.name})
${trackMeta.description}

Topic yang diminta: ${topic} (${TOPIC_LABELS[topic] ?? topic})
Topic resmi di track ini:
${allowedTopics}

(Tidak ada modul pelajaran terperinci untuk topic ini — tetap batasi soal hanya pada topic tersebut.)`;
  }

  const lessonBlocks = lessons.map((lesson, i) => formatLessonBlock(lesson, i + 1));

  return `## Cakupan track ${track} (${trackMeta.name})
${trackMeta.description}

Topic yang diminta: ${topic} (${TOPIC_LABELS[topic] ?? topic})
Topic resmi di track ini (jangan keluar dari topic yang diminta):
${allowedTopics}

## Materi silabus untuk topic ini
${lessonBlocks.join("\n\n")}`;
}

function formatLessonBlock(lesson: Lesson, index: number) {
  const checks = (lesson.checkQuestions ?? [])
    .slice(0, 3)
    .map(
      (q) =>
        `- Latihan: ${q.prompt} → jawaban tipikal: ${q.answer}${
          q.explanation ? ` (${q.explanation})` : ""
        }`,
    )
    .join("\n");

  return `### Modul ${index}: ${lesson.title}
Ringkasan: ${lesson.summary}

Isi materi:
${clip(lesson.body, MAX_LESSON_BODY_CHARS)}
${checks ? `\nContoh tingkat kedalaman (bukan untuk disalin):\n${checks}` : ""}`;
}

export async function generateAndStoreProblem(params: {
  userId: string;
  track: TrackId;
  topic: string;
  difficultyMode: DifficultyMode;
  answerType?: string;
  /** Pre-resolved difficulty (for mock batch normal distribution). */
  difficulty?: 1 | 2 | 3 | 4 | 5;
  /** Free-text student focus for custom mock generation. */
  focusPrompt?: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  /** 1-based index when generating a batch (mock). */
  progressIndex?: number;
  onProgress?: GenerationProgressHandler;
}): Promise<Problem> {
  if (!TRACKS[params.track]) {
    throw new Error("Track tidak valid");
  }
  if (!TRACKS[params.track].topics.includes(params.topic)) {
    throw new Error(
      `Topic "${params.topic}" tidak ada di silabus track ${params.track}`,
    );
  }

  const difficulty =
    params.difficulty ?? resolveDifficulty(params.difficultyMode);
  const answerType = ANSWER_TYPES.includes(
    params.answerType as (typeof ANSWER_TYPES)[number],
  )
    ? params.answerType!
    : "numeric";
  const progressIndex = params.progressIndex ?? 1;
  const onProgress = params.onProgress;

  // Plain chat JSON (no response_format). MiniMax-M3 often breaks with
  // Output.object / json_schema; we parse + repair locally instead.
  const model = createUserProvider({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    modelId: params.modelId,
    jsonOutput: false,
  });

  const syllabus = buildSyllabusContext(params.track, params.topic);
  const focusBlock = params.focusPrompt?.trim()
    ? `
Preferensi / brief siswa untuk paket kuis ini:
"""
${params.focusPrompt.trim()}
"""
- Sesuaikan sudut soal dengan preferensi di atas, tetap di dalam topic "${params.topic}".
- Jika preferensi menyebut beberapa topik, fokuskan bagian yang relevan dengan topic saat ini.
`
    : "";

  const basePrompt = `Buat SATU soal baru yang SELARAS SILABUS.

Track: ${params.track} (${TRACKS[params.track].name})
Topic: ${params.topic} (${TOPIC_LABELS[params.topic] ?? params.topic})
Difficulty: ${difficulty} (1 mudah .. 5 sulit)
AnswerType: ${answerType}

${syllabus}
${focusBlock}
Instruksi akhir:
- Soal harus dapat diselesaikan hanya dengan materi di atas + prasyarat sangat dasar.
- Jangan menguji topic lain di luar "${params.topic}".
- Field track/topic/difficulty/answerType pada JSON harus sesuai permintaan.
- Solusi 3–8 kalimat, plain text (tanpa LaTeX/backslash).
- Balas HANYA satu objek JSON SOAL (bukan JSON Schema).`;

  let payload: GeneratedProblemPayload | null = null;
  let lastError: unknown;
  let previousRaw = "";

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const hadUsableRaw = Boolean(previousRaw.trim());
    const isRepair = attempt > 0 && hadUsableRaw;
    const prompt = isRepair
      ? `Perbaiki menjadi SATU objek JSON SOAL valid (bukan JSON Schema, tanpa markdown, tanpa LaTeX, tanpa komentar).
Wajib punya field: title, track, topic, difficulty, answerType, stem, answer, solution.
Track="${params.track}", topic="${params.topic}", difficulty=${difficulty}, answerType="${answerType}".
Pertahankan isi soal sebisa mungkin.

JSON rusak / salah:
${previousRaw.slice(0, 5000)}`
      : attempt > 0
        ? `${basePrompt}

PERINGATAN PERCOBAAN ULANG:
- Respons sebelumnya kosong atau hanya thinking tanpa JSON soal.
- Tulis objek JSON soal langsung di output utama (content), singkat saja.
- Jangan kembalikan JSON Schema.`
        : basePrompt;

    await onProgress?.({
      type: "attempt",
      index: progressIndex,
      attempt: attempt + 1,
      maxAttempts: MAX_GENERATION_ATTEMPTS,
      phase: isRepair ? "repairing" : "generating",
    });

    let text = "";
    let reasoning = "";

    try {
      const result = streamText({
        model,
        system: GENERATION_SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: attempt === 0 ? 0.4 : 0.15,
        abortSignal: AbortSignal.timeout(GENERATION_ATTEMPT_TIMEOUT_MS),
      });

      let lastThinkingEmit = 0;

      for await (const part of result.fullStream) {
        if (part.type === "reasoning-delta") {
          reasoning += part.text;
          const now = Date.now();
          if (
            onProgress &&
            reasoning.length > 0 &&
            now - lastThinkingEmit >= THINKING_EMIT_MS
          ) {
            lastThinkingEmit = now;
            await onProgress({
              type: "thinking",
              index: progressIndex,
              attempt: attempt + 1,
              text: reasoning,
            });
          }
        } else if (part.type === "text-delta") {
          text += part.text;
        } else if (part.type === "error") {
          const msg =
            part.error instanceof Error
              ? part.error.message
              : typeof part.error === "string"
                ? part.error
                : "Model AI gagal menghasilkan teks";
          throw new Error(msg);
        }
      }

      if (onProgress && reasoning.length > 0) {
        await onProgress({
          type: "thinking",
          index: progressIndex,
          attempt: attempt + 1,
          text: reasoning,
        });
      }

      const finalText = text.trim() || (await result.text).trim();
      const finalReasoning = reasoning.trim();
      // Prefer content; fall back to reasoning (thinking models sometimes put
      // the JSON only there) and a combined blob for interleaved answers.
      previousRaw =
        finalText ||
        finalReasoning ||
        [finalReasoning, finalText].filter(Boolean).join("\n");

      if (!previousRaw.trim()) {
        throw new Error("Model AI mengembalikan respons kosong");
      }

      await onProgress?.({
        type: "attempt",
        index: progressIndex,
        attempt: attempt + 1,
        maxAttempts: MAX_GENERATION_ATTEMPTS,
        phase: "validating",
      });

      payload = normalizeGeneratedProblem(
        generatedProblemSchema.parse(
          parseGeneratedProblemJson(finalText, finalReasoning, previousRaw),
        ),
      );
    } catch (err) {
      lastError = err;
      payload = null;
      // Keep the best model blob we saw for the next repair prompt.
      if (!previousRaw.trim()) {
        previousRaw = [text, reasoning].map((s) => s.trim()).find(Boolean) ?? "";
      }
    }

    if (!payload) continue;

    payload = {
      ...payload,
      track: params.track,
      topic: params.topic,
      difficulty,
      answerType: answerType as GeneratedProblemPayload["answerType"],
    };
    if (payload.answerType === "mcq") {
      if (!payload.choices || payload.choices.length < 2) {
        lastError = new Error("Soal MCQ harus punya choices");
        payload = null;
        continue;
      }
      if (!payload.choices.map(String).includes(String(payload.answer))) {
        lastError = new Error("Jawaban MCQ harus salah satu choices");
        payload = null;
        continue;
      }
    }
    break;
  }

  if (!payload) {
    console.error(
      "[generate-problem] failed",
      {
        track: params.track,
        topic: params.topic,
        answerType,
        attemptError:
          lastError instanceof Error ? lastError.message : String(lastError),
        rawPreview: previousRaw.slice(0, 400),
      },
    );
    throw new Error(
      "Model AI mengembalikan JSON tidak valid. Silakan coba lagi.",
    );
  }

  const id = `ai-${nanoid(10)}`;
  const problem: Problem = {
    ...payload,
    id,
    source: "ai",
    difficulty,
  };

  const db = await getDb();
  await db.insert(generatedProblems).values({
    id,
    userId: params.userId,
    payload: problem,
    track: problem.track,
    topic: problem.topic,
    difficulty: problem.difficulty,
    difficultyMode: params.difficultyMode,
    title: problem.title,
  });

  return problem;
}

export function pickTopicForTrack(track: TrackId, preferred?: string) {
  const topics = TRACKS[track].topics;
  if (preferred && topics.includes(preferred)) return preferred;
  return topics[Math.floor(Math.random() * topics.length)]!;
}
