import { streamText } from "ai";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getDb } from "@/db";
import { generatedProblems } from "@/db/schema";
import {
  createUserProvider,
  generatedProblemSchema,
  normalizeGeneratedProblem,
} from "@/lib/ai/provider";
import {
  type DifficultyMode,
  resolveDifficulty,
} from "@/lib/ai/difficulty";
import type { GenerationProgressHandler } from "@/lib/ai/generation-progress";
import { parseStudyCaseJson } from "@/lib/ai/parse-json-object";
import {
  STUDY_CASE_SYSTEM_PROMPT,
  buildStudyCaseUserPrompt,
} from "@/lib/ai/prediksi-style";
import { verifyGeneratedProblem } from "@/lib/ai/verify-generated-answer";
import { materializeFigures } from "@/lib/ai/diagrams";
import { getLessonsForTopic } from "@/lib/content/load";
import {
  TRACKS,
  TOPIC_LABELS,
  type Problem,
  type TrackId,
} from "@/lib/content/types";

const MAX_ATTEMPTS = 4;
const MAX_OUTPUT_TOKENS = 10_000;
const ATTEMPT_TIMEOUT_MS = 120_000;
const THINKING_EMIT_MS = 160;
const MAX_LESSON_BODY_CHARS = 2200;
const MAX_LESSONS = 2;

const studyCaseItemSchema = z.object({
  title: z.coerce.string().min(2).max(240),
  answerType: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(
      z.enum([
        "numeric",
        "short_string",
        "mcq",
        "python_output",
        "codeSpec",
        "multi_part",
      ]),
    )
    .catch("numeric"),
  // Models sometimes use stem/question instead of prompt
  prompt: z.coerce.string().optional(),
  stem: z.coerce.string().optional(),
  question: z.coerce.string().optional(),
  answer: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number()])),
  ]),
  tolerance: z.coerce.number().optional(),
  choices: z.array(z.union([z.string(), z.number()])).optional(),
  solution: z.coerce.string().min(5),
  starterCode: z.coerce.string().optional(),
}).transform((item, ctx) => {
  const prompt = (item.prompt || item.stem || item.question || "").trim();
  if (prompt.length < 5) {
    ctx.addIssue({
      code: "custom",
      message: "Item problems butuh prompt/stem",
    });
    return z.NEVER;
  }
  return {
    title: item.title,
    answerType: item.answerType,
    prompt,
    answer: item.answer,
    tolerance: item.tolerance,
    choices: item.choices,
    solution: item.solution,
    starterCode: item.starterCode?.trim() || undefined,
  };
});

const studyCaseSchema = z
  .object({
    caseTitle: z.coerce.string().optional(),
    title: z.coerce.string().optional(),
    case_title: z.coerce.string().optional(),
    preamble: z.coerce.string().optional(),
    context: z.coerce.string().optional(),
    sharedContext: z.coerce.string().optional(),
    track: z.enum(["A", "B", "C", "D"]).catch("B"),
    topic: z.coerce.string().min(1).max(64).optional(),
    difficulty: z.coerce.number().int().min(1).max(5).optional(),
    figures: z.array(z.unknown()).optional(),
    problems: z.array(studyCaseItemSchema).min(2).max(8),
  })
  .transform((raw, ctx) => {
    const caseTitle = (
      raw.caseTitle ||
      raw.title ||
      raw.case_title ||
      ""
    ).trim();
    const preamble = (
      raw.preamble ||
      raw.context ||
      raw.sharedContext ||
      ""
    ).trim();
    if (caseTitle.length < 3) {
      ctx.addIssue({ code: "custom", message: "caseTitle terlalu pendek" });
      return z.NEVER;
    }
    if (preamble.length < 10) {
      ctx.addIssue({ code: "custom", message: "preamble terlalu pendek" });
      return z.NEVER;
    }
    return {
      caseTitle,
      preamble,
      track: raw.track,
      topic: raw.topic ?? "",
      difficulty: raw.difficulty ?? 3,
      figures: raw.figures,
      problems: raw.problems,
    };
  });

function clip(text: string, max: number) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}\n…`;
}

function buildSyllabusContext(track: TrackId, topic: string): string {
  const trackMeta = TRACKS[track];
  const lessons = getLessonsForTopic(track, topic).slice(0, MAX_LESSONS);
  const allowedTopics = trackMeta.topics
    .map((t) => `- ${t} (${TOPIC_LABELS[t] ?? t})`)
    .join("\n");

  if (lessons.length === 0) {
    return `## Cakupan track ${track} (${trackMeta.name})
${trackMeta.description}

Topic: ${topic} (${TOPIC_LABELS[topic] ?? topic})
${allowedTopics}`;
  }

  const blocks = lessons.map((lesson, i) => {
    return `### Modul ${i + 1}: ${lesson.title}
${lesson.summary}

${clip(lesson.body, MAX_LESSON_BODY_CHARS)}`;
  });

  return `## Cakupan track ${track} (${trackMeta.name})
${trackMeta.description}

Topic: ${topic} (${TOPIC_LABELS[topic] ?? topic})
${allowedTopics}

## Materi silabus
${blocks.join("\n\n")}`;
}

export type StudyCaseResult = {
  caseId: string;
  caseTitle: string;
  problems: Problem[];
};

export async function generateAndStoreStudyCase(params: {
  userId: string;
  track: TrackId;
  topic: string;
  difficultyMode: DifficultyMode;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  problemCount?: number;
  focusPrompt?: string;
  includeFigures?: boolean;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  onProgress?: GenerationProgressHandler;
}): Promise<StudyCaseResult> {
  if (!TRACKS[params.track]) throw new Error("Track tidak valid");
  if (!TRACKS[params.track].topics.includes(params.topic)) {
    throw new Error(
      `Topic "${params.topic}" tidak ada di silabus track ${params.track}`,
    );
  }

  const difficulty =
    params.difficulty ?? resolveDifficulty(params.difficultyMode);
  const problemCount = Math.min(5, Math.max(3, params.problemCount ?? 4));
  const includeFigures = Boolean(params.includeFigures);
  const onProgress = params.onProgress;

  const model = createUserProvider({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    modelId: params.modelId,
    jsonOutput: false,
    disableThinking: true,
  });

  const syllabus = buildSyllabusContext(params.track, params.topic);
  const basePrompt = `${buildStudyCaseUserPrompt({
    track: params.track,
    trackName: TRACKS[params.track].name,
    topic: params.topic,
    topicLabel: TOPIC_LABELS[params.topic] ?? params.topic,
    difficulty,
    problemCount,
    syllabus,
    focusPrompt: params.focusPrompt,
  })}
${
  includeFigures
    ? `\nGambar: sertakan "figures" di root JSON jika kasus butuh visual; pakai {{fig:id}} di preamble.`
    : `\nGambar: JANGAN sertakan figures; preamble text-only tanpa {{fig:...}}.`
}`;

  let parsed: z.infer<typeof studyCaseSchema> | null = null;
  let lastError: unknown;
  let previousRaw = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const hadUsableRaw = Boolean(previousRaw.trim());
    const isRepair = attempt > 0 && hadUsableRaw;
    const prompt = isRepair
      ? `Perbaiki menjadi SATU objek JSON STUDI KASUS valid (bukan schema).
Wajib: caseTitle, preamble, track, topic, difficulty, problems[${problemCount}].
Track="${params.track}", topic="${params.topic}", difficulty=${difficulty}.
Setiap item problems: title, answerType, prompt, answer, solution (+ choices jika mcq; + starterCode jika python_output).

JSON rusak:
${previousRaw.slice(0, 7000)}`
      : attempt > 0
        ? `${basePrompt}

PERINGATAN: respons sebelumnya kosong/invalid. Tulis JSON studi kasus langsung di content.`
        : basePrompt;

    await onProgress?.({
      type: "attempt",
      index: 1,
      attempt: attempt + 1,
      maxAttempts: MAX_ATTEMPTS,
      phase: isRepair ? "repairing" : "generating",
    });

    let text = "";
    let reasoning = "";

    try {
      const result = streamText({
        model,
        system: STUDY_CASE_SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: attempt === 0 ? 0.45 : 0.15,
        abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
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
              index: 1,
              attempt: attempt + 1,
              text: reasoning,
            });
          }
        } else if (part.type === "text-delta") {
          text += part.text;
        } else if (part.type === "error") {
          throw new Error(
            part.error instanceof Error
              ? part.error.message
              : "Model AI gagal menghasilkan teks",
          );
        }
      }

      if (onProgress && reasoning.length > 0) {
        await onProgress({
          type: "thinking",
          index: 1,
          attempt: attempt + 1,
          text: reasoning,
        });
      }

      const finalText = text.trim() || (await result.text).trim();
      const finalReasoning = reasoning.trim();
      previousRaw =
        finalText ||
        finalReasoning ||
        [finalReasoning, finalText].filter(Boolean).join("\n");

      if (!previousRaw.trim()) {
        throw new Error("Model AI mengembalikan respons kosong");
      }

      await onProgress?.({
        type: "attempt",
        index: 1,
        attempt: attempt + 1,
        maxAttempts: MAX_ATTEMPTS,
        phase: "validating",
      });

      const json = parseStudyCaseJson(finalText, finalReasoning, previousRaw);
      parsed = studyCaseSchema.parse(json);
      // Prefer exact requested count; keep extras only if short.
      if (parsed.problems.length > problemCount) {
        parsed = {
          ...parsed,
          problems: parsed.problems.slice(0, problemCount),
        };
      }
    } catch (err) {
      lastError = err;
      parsed = null;
      if (!previousRaw.trim()) {
        previousRaw = [text, reasoning].map((s) => s.trim()).find(Boolean) ?? "";
      }
    }

    if (parsed) break;
  }

  if (!parsed) {
    console.error("[generate-study-case] failed", {
      track: params.track,
      topic: params.topic,
      problemCount,
      attemptError:
        lastError instanceof Error ? lastError.message : String(lastError),
      rawPreview: previousRaw.slice(0, 600),
    });
    throw new Error(
      "Model AI mengembalikan JSON studi kasus tidak valid. Silakan coba lagi.",
    );
  }

  const caseId = `case-${nanoid(10)}`;
  const caseTitle = parsed.caseTitle.trim();
  const problems: Problem[] = [];
  const db = await getDb();

  for (let i = 0; i < parsed.problems.length; i++) {
    const item = parsed.problems[i]!;
    const id = `ai-${nanoid(10)}`;
    let preamble = parsed.preamble.trim();
    let figures: Problem["figures"];
    try {
      const materialized = materializeFigures({
        problemId: id,
        text: preamble,
        figuresRaw: parsed.figures,
        includeFigures,
      });
      preamble = materialized.text;
      figures = materialized.figures.length ? materialized.figures : undefined;
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? `Gambar studi kasus: ${err.message}`
          : "Gagal merender gambar studi kasus.",
      );
    }

    const rawPayload = normalizeGeneratedProblem(
      generatedProblemSchema.parse({
        title: item.title,
        track: params.track,
        topic: params.topic,
        difficulty,
        answerType: item.answerType === "multi_part" ? "short_string" : item.answerType,
        stem: `${preamble}\n\n${item.prompt.trim()}`,
        answer: item.answer,
        tolerance: item.tolerance,
        choices: item.choices,
        solution: item.solution,
        starterCode: item.starterCode,
        tags: ["prediksi-style", "study-case", caseId],
      }),
    );

    const verified = verifyGeneratedProblem(rawPayload, {
      styleTag: "prediksi-style",
    });
    if (!verified.ok) {
      throw new Error(
        `Soal studi kasus #${i + 1} gagal verifikasi: ${verified.error}`,
      );
    }

    const problem: Problem = {
      ...verified.payload,
      id,
      source: "ai",
      difficulty: difficulty as 1 | 2 | 3 | 4 | 5,
      figures,
      tags: [
        ...(verified.payload.tags ?? []),
        `case:${caseId}`,
        `case-part:${i + 1}`,
      ],
    };

    await db.insert(generatedProblems).values({
      id,
      userId: params.userId,
      payload: problem,
      track: problem.track,
      topic: problem.topic,
      difficulty: problem.difficulty,
      difficultyMode: params.difficultyMode,
      title: `${caseTitle} — ${problem.title}`,
    });

    // Keep display title as part title; case title is in DB title for admin lists
    problems.push({ ...problem, title: problem.title });

    await onProgress?.({
      type: "question_done",
      index: i + 1,
      total: parsed.problems.length,
      title: problem.title,
      topic: problem.topic,
      topicLabel: TOPIC_LABELS[problem.topic] ?? problem.topic,
    });

    await onProgress?.({
      type: "slot_done",
      phase: "slot",
      planId: caseId,
      index: i,
      problemId: id,
      title: problem.title,
      topic: problem.topic,
      topicLabel: TOPIC_LABELS[problem.topic] ?? problem.topic,
      difficulty: problem.difficulty,
    });
  }

  return { caseId, caseTitle, problems };
}
