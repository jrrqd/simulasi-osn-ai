import {
  resolveDifficulty,
  type DifficultyMode,
} from "@/lib/ai/difficulty";
import {
  CURATED_MOCK_SIZES,
  type CuratedMockSize,
} from "@/lib/ai/curated-mock-size";
import {
  matchTopicsFromPrompt,
  topicPairsFromPrompt,
} from "@/lib/ai/topic-prompt";
import { buildNaturalMockTitle } from "@/lib/ai/mock-title";
import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";

function pickTopicForTrack(track: TrackId, preferred?: string) {
  const topics = TRACKS[track].topics;
  if (preferred && topics.includes(preferred)) return preferred;
  return topics[Math.floor(Math.random() * topics.length)]!;
}

export const MOCK_QUESTION_COUNT = 10;
export const MOCK_DURATION_MINUTES = 30;

export type AiMockSize = "quick" | CuratedMockSize;

export const AI_MOCK_SIZES: {
  value: AiMockSize;
  label: string;
  count: number;
  durationMinutes: number;
}[] = [
  {
    value: "quick",
    label: "10 soal · 30 menit",
    count: MOCK_QUESTION_COUNT,
    durationMinutes: MOCK_DURATION_MINUTES,
  },
  ...CURATED_MOCK_SIZES,
];

export function parseAiMockSize(raw: unknown): AiMockSize {
  if (raw === "half" || raw === "full" || raw === "quick") return raw;
  return "quick";
}

export function aiMockSizeMeta(size: AiMockSize) {
  return AI_MOCK_SIZES.find((s) => s.value === size) ?? AI_MOCK_SIZES[0]!;
}

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
  questionCount: number;
  durationMinutes: number;
  size: AiMockSize;
};

const ANSWER_TYPES: AiMockAnswerType[] = [
  "numeric",
  "mcq",
  "short_string",
  "numeric",
];

const TRACK_CYCLE = Object.keys(TRACKS) as TrackId[];

export function buildAiMockPlan(params: {
  generationMode: "standard" | "custom";
  track: TrackId | "ALL";
  difficultyMode: DifficultyMode;
  topicPrompt?: string;
  preferredTopic?: string;
  size?: AiMockSize;
}): { slots: AiMockSlot[]; meta: AiMockPlanMeta } {
  const size = params.size ?? "quick";
  const sizeMeta = aiMockSizeMeta(size);
  const count = sizeMeta.count;
  const durationMinutes = sizeMeta.durationMinutes;

  let track: TrackId =
    params.track !== "ALL" && TRACKS[params.track] ? params.track : "B";
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
  for (let i = 0; i < count; i++) {
    const difficulty = resolveDifficulty(params.difficultyMode);
    let questionTrack = track;
    let topic: string;

    if (topicPairs && topicPairs.length > 0) {
      const pair = topicPairs[i % topicPairs.length]!;
      questionTrack = pair.track;
      topic = pair.topic;
    } else if (params.track === "ALL" && params.generationMode === "standard") {
      questionTrack = TRACK_CYCLE[i % TRACK_CYCLE.length]!;
      topic = pickTopicForTrack(questionTrack, params.preferredTopic);
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

  const mockTrack =
    params.generationMode === "custom" || params.track === "ALL"
      ? "ALL"
      : track;
  const title = buildNaturalMockTitle({
    kind: "ai",
    generationMode: params.generationMode,
    track: mockTrack,
    difficultyMode: params.difficultyMode,
    count,
    topicLabels:
      preferred.length > 0
        ? preferred.slice(0, 3).map((t) => TOPIC_LABELS[t] ?? t)
        : undefined,
    topicPrompt: params.topicPrompt,
  });
  const description =
    params.generationMode === "custom" && params.topicPrompt
      ? `${count} soal AI bersama (${durationMinutes} menit) mengikuti brief: ${params.topicPrompt.slice(0, 180)}`
      : `${count} soal AI baru (${durationMinutes} menit). Dibuat otomatis; dapat dikerjakan semua siswa.`;

  return {
    slots,
    meta: {
      generationMode: params.generationMode,
      difficultyMode: params.difficultyMode,
      topicPrompt: params.topicPrompt,
      mockTrack,
      title,
      description,
      questionCount: count,
      durationMinutes,
      size,
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
