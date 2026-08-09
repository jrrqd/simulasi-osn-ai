import { streamText } from "ai";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { generatedProblems } from "@/db/schema";
import {
  GENERATION_SYSTEM_PROMPT,
  createUserProvider,
  generatedProblemSchema,
  normalizeGeneratedProblem,
  remapKaggleShape,
  type GeneratedProblemPayload,
} from "@/lib/ai/provider";
import {
  type DifficultyMode,
  resolveDifficulty,
} from "@/lib/ai/difficulty";
import type { GenerationProgressHandler } from "@/lib/ai/generation-progress";
import { parseGeneratedProblemJson } from "@/lib/ai/parse-json-object";
import { verifyGeneratedProblem } from "@/lib/ai/verify-generated-answer";
import { materializeFigures } from "@/lib/ai/diagrams";
import {
  materializeImages,
  parseImagePrompts,
} from "@/lib/ai/materialize-images";
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
// Kaggle long-form coding payloads (rich stem + skeleton + ≥5 test cases)
// easily exceed 4500 tokens of JSON. Bump the budget for those.
const MAX_OUTPUT_TOKENS_LONGFORM = 12000;
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
  "codeSpec",
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
  /** Override per-question weight (coding=2, numeric=1). */
  weight?: number;
  /** Free-text student focus for custom mock generation. */
  focusPrompt?: string;
  /** When true, prompt model for diagram specs and materialize SVG figures. */
  includeFigures?: boolean;
  /** Longer Kaggle-style codeSpec (richer stem, ≥5 tests, weight 5). */
  longFormCoding?: boolean;
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
  // disableThinking: skip M3's chain-of-thought for structured-output tasks —
  // the model otherwise dumps the entire answer into reasoning_content and
  // emits nothing to the text channel (kaggle codeSpec problems were 0/14k).
  const model = createUserProvider({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    modelId: params.modelId,
    jsonOutput: false,
    disableThinking: true,
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

  const includeFigures = Boolean(params.includeFigures);
  const figureBlock = includeFigures
    ? `
Gambar (WAJIB dipertimbangkan):
- Sertakan field "figures" bila soal butuh plot/citra/kernel/pohon/grafik/tabel visual (diagram SVG).
- Sertakan field "imagePrompts" bila soal butuh ilustrasi geometri (segitiga berlabel, lingkaran, bangun 3D, konstruksi koordinat) yang tidak bisa digambar sebagai scatter/grid/tree/dll.
- imagePrompts: array { "id", "alt", "prompt" }; prompt bahasa Inggris, gaya "clean exam diagram, labeled, white background". Maks 4.
- Sisipkan {{fig:ID}} di stem di tempat gambar harus muncul (berlaku untuk figures DAN imagePrompts).
- Prefer minimal satu figure/image untuk topic visual ATAU soal geometri.
- Jika soal murni teks/hitungan tanpa visual, figures dan imagePrompts boleh [].
`
    : `
Gambar:
- JANGAN sertakan figures (diagram SVG).
- Boleh sertakan "imagePrompts" HANYA jika soal benar-benar butuh ilustrasi geometri (segitiga/lingkaran/bangun 3D berlabel). Format: { "id", "alt", "prompt" }; sisipkan {{fig:ID}} di stem. Maks 4.
- Jika tidak butuh geometri, jangan sertakan imagePrompts dan jangan tulis placeholder {{fig:...}}.
`;

  const basePrompt = `Buat SATU soal baru yang SELARAS SILABUS${
    params.longFormCoding && answerType === "codeSpec"
      ? ", bergaya Kaggle style / coding marathon (satu tantangan implementasi yang dalam)"
      : ", bergaya studi kasus PREDIKSI (cerita konkret, hitung-lalu-pilih)"
  }.

Track: ${params.track} (${TRACKS[params.track].name})
Topic: ${params.topic} (${TOPIC_LABELS[params.topic] ?? params.topic})
Difficulty: ${difficulty} (1 mudah .. 5 sulit)
AnswerType: ${answerType}

${syllabus}
${focusBlock}
${figureBlock}
${
  answerType === "codeSpec"
    ? params.longFormCoding
      ? `WAJIB: JSON berisi field persis ini (string kecuali ditentukan lain):
- "title": string pendek ≤ 120 char
- "track": "${params.track}"
- "topic": "${params.topic}"
- "difficulty": ${difficulty}
- "answerType": "codeSpec"
- "stem": string markdown kaya — gabungkan di sini: konteks/latar, spesifikasi I/O lengkap, constraints, contoh input/output, edge case. Gunakan heading ## / daftar untuk keterbacaan. JANGAN pecah jadi field lain (story/inputFormat/...); semuanya masuk "stem".
- "answer": boleh string ringkas (mis. "lihat testCases") — penilaian dari test case.
- "solution": string 3–8 kalimat menjelaskan ide algoritma + kompleksitas.
- "codeSpec": object { skeleton, testCases, timeLimitMs, memoryLimitMb }
  - skeleton: string Python WAJIB berisi marker "# >>> WRITE HERE <<<" … "# <<< END <<<".
  - testCases: array ≥ 5 {input, expectedOutput}; termasuk edge case.
  - timeLimitMs: integer 500–10000.
  - memoryLimitMb: integer 64–1024.
- "weight": 5
- "tags": [], tambahkan "prediksi-style" dan "kaggle-style".

Jangan minta siswa pindah tab / buka IDE eksternal / unduh dataset eksternal.
Fokus implementasi algoritma/ML kecil yang realistis in-exam dalam ~1–2 jam.
`
      : `Instruksi coding Python (OSN AI 2026 / codeSpec):
- WAJIB isi "codeSpec" dengan skeleton berisi marker "# >>> WRITE HERE <<<" … "# <<< END <<<".
  (opsional: lockedRanges [[startLine,endLine],…] 1-based bila marker belum ada)
- WAJIB ≥ 3 testCases {input, expectedOutput}; sertakan edge case.
- WAJIB timeLimitMs (500–10000) dan memoryLimitMb (64–1024).
- weight = 2.
- answer boleh string ringkas (mis. "lihat testCases") — penilaian dari test case.
- Jangan minta siswa pindah tab / buka IDE eksternal.
`
    : answerType === "python_output"
      ? `Instruksi Python legacy (python_output):
- WAJIB isi "starterCode" dengan program lengkap untuk runner in-exam.
- Jangan minta siswa pindah tab / buka IDE eksternal.
- Jawaban = stdout deterministik dari starterCode.
`
      : answerType === "numeric"
        ? `Instruksi numeric (OSN AI 2026):
- WAJIB isi "numericFormat": integer | decimal | space_separated | comma_separated.
  (alias "expectedFormat" juga diterima, tapi prefer numericFormat)
- Jawaban harus PERSIS sesuai format (integer: "25" bukan "25.0").
- Sebutkan format di stem.
- weight = 1.
`
        : ""
}Instruksi akhir:
- Soal harus dapat diselesaikan hanya dengan materi di atas + prasyarat sangat dasar.
- Jika memakai konsep matematika non-SMA, jelaskan 1–3 kalimat di awal stem.
- Jangan menguji topic lain di luar "${params.topic}".
- Field track/topic/difficulty/answerType pada JSON harus sesuai permintaan.
- JANGAN bikin field terpisah (story/inputFormat/constraints/examples/...); semua penjelasan I/O, constraints, contoh, dan edge case harus masuk "stem" sebagai markdown.
- Solusi 3–8 kalimat; rumus boleh KaTeX $...$ atau plain text.
- Tambahkan "prediksi-style" di tags${params.longFormCoding ? '; tambahkan juga "kaggle-style"' : ""}.
- Balas HANYA satu objek JSON SOAL (bukan JSON Schema).`;

  let payload: GeneratedProblemPayload | null = null;
  let lastError: unknown;
  let previousRaw = "";
  let previousText = "";
  let previousReasoning = "";
  let problemId = "";
  let problemFigures: Problem["figures"];
  let problemImages: Problem["images"];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    // Distinguish "broken JSON" (text present, parse failed) from "thinking
    // only" (text empty, reasoning filled). The latter is a stronger signal
    // that the model is over-thinking and we should re-prompt with terser
    // instructions, not send the reasoning blob back as a "repair" target.
    const hadUsableRaw = Boolean(previousRaw.trim());
    const reasoningOnly =
      !previousText.trim() && Boolean(previousReasoning.trim());
    const isRepair = attempt > 0 && hadUsableRaw && !reasoningOnly;
    const prompt = isRepair
      ? `Perbaiki menjadi SATU objek JSON SOAL valid (bukan JSON Schema, tanpa markdown fence, tanpa komentar).
Wajib punya field: title, track, topic, difficulty, answerType, stem, answer, solution.
Track="${params.track}", topic="${params.topic}", difficulty=${difficulty}, answerType="${answerType}".
KaTeX $...$ boleh; escape backslash ganda di JSON. Pertahankan isi soal sebisa mungkin.

JSON rusak / salah:
${previousRaw.slice(0, 5000)}`
      : attempt > 0 && reasoningOnly
        ? `${basePrompt}
|
|PERINGATAN PERCOBAAN ULANG:
|- Respons sebelumnya HANYA berisi chain-of-thought di reasoning_content — tidak ada JSON di output utama (content).
|- JANGAN tulis kode program, contoh, atau langkah hitung di reasoning. Langsung tulis SATU objek JSON SOAL valid di output utama (content).
|- JANGAN berpikir berlebihan. Pendek dan langsung: title, stem, answer, solution, codeSpec, testCases.
|- Jangan kembalikan JSON Schema.`
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
        maxOutputTokens: params.longFormCoding
          ? MAX_OUTPUT_TOKENS_LONGFORM
          : MAX_OUTPUT_TOKENS,
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
      // Track text vs reasoning separately so the next iteration can detect
      // "thinking-only" output and trigger a stricter retry prompt.
      previousText = finalText;
      previousReasoning = finalReasoning;
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
          remapKaggleShape(
            parseGeneratedProblemJson(finalText, finalReasoning, previousRaw),
          ),
        ),
      );
    } catch (err) {
      lastError = err;
      payload = null;
      // Keep the best model blob we saw for the next repair prompt.
      if (!previousRaw.trim()) {
        previousRaw = [text, reasoning].map((s) => s.trim()).find(Boolean) ?? "";
      }
      // Track text vs reasoning separately (needed for the reasoning-only case).
      if (!previousText) previousText = text.trim();
      if (!previousReasoning) previousReasoning = reasoning.trim();
    }

    if (!payload) continue;

    payload = {
      ...payload,
      track: params.track,
      topic: params.topic,
      difficulty,
      answerType: answerType as GeneratedProblemPayload["answerType"],
    };
    const verified = verifyGeneratedProblem(payload, {
      styleTag: "prediksi-style",
    });
    if (!verified.ok) {
      lastError = new Error(verified.error || "Verifikasi soal gagal");
      payload = null;
      continue;
    }

    const idCandidate = `ai-${nanoid(10)}`;
    try {
      const imagePrompts = parseImagePrompts(verified.payload.imagePrompts);
      const deferPlaceholderIds = new Set(imagePrompts.map((p) => p.id));

      const materialized = materializeFigures({
        problemId: idCandidate,
        text: verified.payload.stem,
        figuresRaw: verified.payload.figures,
        includeFigures,
        deferPlaceholderIds,
      });

      const raster = await materializeImages({
        problemId: idCandidate,
        text: materialized.text,
        imagePromptsRaw: verified.payload.imagePrompts,
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
      });

      const {
        figures: _figures,
        imagePrompts: _imagePrompts,
        ...restPayload
      } = verified.payload;

      payload = {
        ...restPayload,
        stem: raster.text,
      };
      problemId = idCandidate;
      problemFigures = materialized.figures.length
        ? materialized.figures
        : undefined;
      problemImages = raster.images.length ? raster.images : undefined;
    } catch (err) {
      lastError = err;
      payload = null;
      continue;
    }
    break;
  }

  if (!payload || !problemId) {
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

  const problem: Problem = {
    ...payload,
    id: problemId,
    source: "ai",
    difficulty,
    figures: problemFigures,
    images: problemImages,
    legacy: false,
    weight:
      params.weight ??
      payload.weight ??
      (payload.answerType === "codeSpec" || payload.codeSpec
        ? params.longFormCoding
          ? 5
          : 2
        : 1),
  };

  const db = await getDb();
  await db.insert(generatedProblems).values({
    id: problemId,
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
