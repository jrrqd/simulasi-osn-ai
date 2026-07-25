import {
  labelDifficultyMode,
  resolveDifficulty,
  type DifficultyMode,
} from "@/lib/ai/difficulty";
import {
  matchTopicsFromPrompt,
  topicPairsFromPrompt,
} from "@/lib/ai/topic-prompt";
import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";

function pickTopicForTrack(track: TrackId, preferred?: string) {
  const topics = TRACKS[track].topics;
  if (preferred && topics.includes(preferred)) return preferred;
  return topics[Math.floor(Math.random() * topics.length)]!;
}

export const MOCK_QUESTION_COUNT = 10;
export const MOCK_DURATION_MINUTES = 30;

export type AiMockAnswerType = "numeric" | "mcq" | "short_string";

export type AiMockSlot = {
  index: number;
  track: TrackId;
  topic: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  answerType: AiMockAnswerType;
};

export type AiMockPlanMeta = {
  generationMode: "standard" | "custom";
  difficultyMode: DifficultyMode;
  topicPrompt?: string;
  /** Persisted mock track field. */
  mockTrack: TrackId | "ALL";
  title: string;
  description: string;
};

const ANSWER_TYPES: AiMockAnswerType[] = [
  "numeric",
  "mcq",
  "short_string",
  "numeric",
];

export function buildAiMockPlan(params: {
  generationMode: "standard" | "custom";
  track: TrackId;
  difficultyMode: DifficultyMode;
  topicPrompt?: string;
  preferredTopic?: string;
}): { slots: AiMockSlot[]; meta: AiMockPlanMeta } {
  let track = params.track;
  const topicPairs =
    params.generationMode === "custom" && params.topicPrompt
      ? topicPairsFromPrompt(
          params.topicPrompt,
          TRACKS[track] ? track : "B",
        )
      : null;

  if (topicPairs && topicPairs.length > 0) {
    track = topicPairs[0]!.track;
  }

  const slots: AiMockSlot[] = [];
  for (let i = 0; i < MOCK_QUESTION_COUNT; i++) {
    const difficulty = resolveDifficulty(params.difficultyMode);
    let questionTrack = track;
    let topic: string;

    if (topicPairs && topicPairs.length > 0) {
      const pair = topicPairs[i % topicPairs.length]!;
      questionTrack = pair.track;
      topic = pair.topic;
    } else {
      topic = pickTopicForTrack(track, params.preferredTopic);
    }

    slots.push({
      index: i,
      track: questionTrack,
      topic,
      difficulty,
      answerType: ANSWER_TYPES[i % ANSWER_TYPES.length]!,
    });
  }

  const preferred = params.topicPrompt
    ? matchTopicsFromPrompt(params.topicPrompt)
    : [];
  const topicLabel =
    preferred.length > 0
      ? preferred
          .slice(0, 3)
          .map((t) => TOPIC_LABELS[t] ?? t)
          .join(", ")
      : null;

  const mockTrack =
    params.generationMode === "custom" ? "ALL" : track;
  const title =
    params.generationMode === "custom"
      ? `Simulasi AI · Custom${topicLabel ? ` · ${topicLabel}` : " topik"}`
      : `Simulasi AI · Track ${track} · ${labelDifficultyMode(params.difficultyMode)}`;
  const description =
    params.generationMode === "custom" && params.topicPrompt
      ? `10 soal AI bersama (${MOCK_DURATION_MINUTES} menit) mengikuti brief: ${params.topicPrompt.slice(0, 180)}`
      : `10 soal AI bersama (${MOCK_DURATION_MINUTES} menit). Dibuat otomatis; dapat dikerjakan semua siswa.`;

  return {
    slots,
    meta: {
      generationMode: params.generationMode,
      difficultyMode: params.difficultyMode,
      topicPrompt: params.topicPrompt,
      mockTrack,
      title,
      description,
    },
  };
}

export function isAiMockSlot(value: unknown): value is AiMockSlot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const track = String(v.track ?? "");
  const topic = String(v.topic ?? "");
  const answerType = String(v.answerType ?? "");
  const difficulty = Number(v.difficulty);
  if (!TRACKS[track as TrackId]) return false;
  if (!TRACKS[track as TrackId].topics.includes(topic)) return false;
  if (!ANSWER_TYPES.includes(answerType as AiMockAnswerType)) return false;
  if (![1, 2, 3, 4, 5].includes(difficulty)) return false;
  return true;
}
