import { generateText, Output } from "ai";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { generatedProblems } from "@/db/schema";
import {
  GENERATION_SYSTEM_PROMPT,
  createUserProvider,
  generatedProblemSchema,
  type GeneratedProblemPayload,
} from "@/lib/ai/provider";
import {
  type DifficultyMode,
  resolveDifficulty,
} from "@/lib/ai/difficulty";
import { getLessonsForTopic } from "@/lib/content/load";
import type { Lesson } from "@/lib/content/types";
import {
  TRACKS,
  TOPIC_LABELS,
  type Problem,
  type TrackId,
} from "@/lib/content/types";

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
  baseUrl: string;
  apiKey: string;
  modelId: string;
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

  const model = createUserProvider({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    modelId: params.modelId,
    jsonOutput: true,
  });

  const syllabus = buildSyllabusContext(params.track, params.topic);

  const prompt = `Buat SATU soal baru yang SELARAS SILABUS.

Track: ${params.track} (${TRACKS[params.track].name})
Topic: ${params.topic} (${TOPIC_LABELS[params.topic] ?? params.topic})
Difficulty: ${difficulty} (1 mudah .. 5 sulit)
AnswerType: ${answerType}

${syllabus}

Instruksi akhir:
- Soal harus dapat diselesaikan hanya dengan materi di atas + prasyarat sangat dasar.
- Jangan menguji topic lain di luar "${params.topic}".
- Field track/topic/difficulty/answerType pada JSON harus sesuai permintaan.
- Solusi detail langkah demi langkah, merujuk konsep dari materi silabus.`;

  let payload: GeneratedProblemPayload;
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: generatedProblemSchema }),
        system: GENERATION_SYSTEM_PROMPT,
        prompt,
        abortSignal: AbortSignal.timeout(180_000),
      });
      payload = generatedProblemSchema.parse(result.output);
      payload = {
        ...payload,
        track: params.track,
        topic: params.topic,
        difficulty,
        answerType: answerType as GeneratedProblemPayload["answerType"],
      };
      if (payload.answerType === "mcq") {
        if (!payload.choices || payload.choices.length < 2) {
          throw new Error("Soal MCQ harus punya choices");
        }
        if (!payload.choices.map(String).includes(String(payload.answer))) {
          throw new Error("Jawaban MCQ harus salah satu choices");
        }
      }
      break;
    } catch (err) {
      if (attempt >= 1) throw err;
    }
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
