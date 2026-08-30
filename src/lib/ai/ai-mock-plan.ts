import {
  resolveDifficulty,
  type DifficultyMode,
} from "@/lib/ai/difficulty";
import {
  CURATED_MOCK_SIZES,
  DEFAULT_CODING_RATIO,
  DEFAULT_CODING_WEIGHT,
  DEFAULT_NUMERIC_WEIGHT,
  codingCountForTotal,
  type CuratedMockSize,
} from "@/lib/ai/curated-mock-size";
import {
  FINAL_EKKA_PRESETS,
  finalEkkaCodingCounts,
  getFinalEkkaPreset,
  isFinalEkkaPresetId,
  type FinalEkkaPresetId,
} from "@/lib/ai/final-ekka-presets";
import {
  matchTopicsFromPrompt,
  topicPairsFromPrompt,
} from "@/lib/ai/topic-prompt";
import { buildNaturalMockTitle } from "@/lib/ai/mock-title";
import {
  isIoaiSyllabusTopic,
  pickIoaiSyllabusTopic,
  trackForIoaiTopic,
} from "@/lib/content/ioai-syllabus";
import {
  DEFAULT_IOAI_PACK_YEAR,
  getIoaiYearPack,
  parseIoaiPackYear,
  type IoaiPackYear,
} from "@/lib/content/ioai-year-packs";
import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";
import type { ExamFormat, SubmissionScoringMode } from "@/lib/content/types";
import {
  SEMIFINAL_TOPICS,
  type Phase,
} from "@/lib/user/phase";

const PRESELEKSI_TOPICS = new Set(
  (Object.keys(TRACKS) as TrackId[]).flatMap((track) =>
    TRACKS[track].topics.filter(
      (t) => !(SEMIFINAL_TOPICS as readonly string[]).includes(t),
    ),
  ),
);

const SEMIFINAL_TOPIC_SET = new Set<string>(SEMIFINAL_TOPICS);

/** Soft topic weights for default (non-custom-brief) mock planning. */
export function topicWeightForPhase(phase: Phase, topic: string): number {
  const isSemifinalTopic = SEMIFINAL_TOPIC_SET.has(topic);
  const isPreseleksiTopic = PRESELEKSI_TOPICS.has(topic);

  if (phase === "pre-seleksi") {
    if (isSemifinalTopic) return 0;
    return 1;
  }
  if (phase === "semifinal") {
    if (isSemifinalTopic) return 2.0;
    if (isPreseleksiTopic) return 0.5;
    return 0.5;
  }
  // final — IOAI-adjacent bias
  if (
    topic === "transformer-lanjut" ||
    topic === "cnn-arsitektur" ||
    topic === "aljabar-linier-lanjut"
  ) {
    return 1.4;
  }
  if (isSemifinalTopic) return 1.0;
  if (isPreseleksiTopic) return 0.5;
  return 0.5;
}

function pickWeightedTopic(
  topics: string[],
  phase: Phase,
  preferred?: string,
): string {
  if (preferred && topics.includes(preferred)) return preferred;

  const weighted = topics
    .map((topic) => ({ topic, weight: topicWeightForPhase(phase, topic) }))
    .filter((entry) => entry.weight > 0);

  const pool =
    weighted.length > 0
      ? weighted
      : topics.map((topic) => ({
          topic,
          weight: 1,
        }));

  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.random() * total;
  for (const entry of pool) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.topic;
  }
  return pool[pool.length - 1]!.topic;
}

function pickTopicForTrack(
  track: TrackId,
  phase: Phase,
  preferred?: string,
  options?: {
    restrictToSemifinalTopics?: boolean;
    restrictToIoaiSyllabus?: boolean;
    slotIndex?: number;
  },
) {
  const trackTopics = TRACKS[track].topics;
  if (options?.restrictToIoaiSyllabus) {
    const ioaiOnTrack = trackTopics.filter((t) => isIoaiSyllabusTopic(t));
    return pickIoaiSyllabusTopic(
      ioaiOnTrack.length > 0 ? ioaiOnTrack : trackTopics,
      options.slotIndex ?? 0,
      preferred,
    );
  }
  const topics = options?.restrictToSemifinalTopics
    ? trackTopics.filter((t) => SEMIFINAL_TOPIC_SET.has(t))
    : trackTopics;
  // Fall back to full track topics if this track has no semifinal topics.
  return pickWeightedTopic(
    topics.length > 0 ? topics : trackTopics,
    phase,
    preferred,
  );
}

export const MOCK_QUESTION_COUNT = 10;
export const MOCK_DURATION_MINUTES = 30;

export const KAGGLE_CODING_WEIGHT = 5;

/** Rotating metrics for kaggle competitions (supports 3- and 5-slot packs). */
export const KAGGLE_SLOT_METRICS: SubmissionScoringMode[] = [
  "accuracy",
  "f1_macro",
  "rmse",
  "mae",
  "accuracy",
];

/** Any size whose label/mix is Kaggle-style coding marathon. */
export const KAGGLE_SIZES = ["kaggle", "kaggle-150", "kaggle-300"] as const;
export type KaggleSize = (typeof KAGGLE_SIZES)[number];

export function isKaggleSize(size: AiMockSize): size is KaggleSize {
  return (KAGGLE_SIZES as readonly string[]).includes(size);
}

/** Final IOAI marathon: 5 competitions · 5 hours. */
export function isFinalKaggleSize(size: AiMockSize): boolean {
  return size === "kaggle-300";
}

/** Dedicated Final EKKA 2026 Day 1 / Day 2 presets. */
export function isFinalEkkaSize(size: AiMockSize): size is FinalEkkaPresetId {
  return isFinalEkkaPresetId(size);
}

export type AiMockSize =
  | "quick"
  | CuratedMockSize
  | KaggleSize
  | FinalEkkaPresetId;

export const AI_MOCK_SIZES: {
  value: AiMockSize;
  label: string;
  count: number;
  durationMinutes: number;
  codingRatio: number;
}[] = [
  {
    value: "quick",
    label: "10 soal · 30 menit",
    count: MOCK_QUESTION_COUNT,
    durationMinutes: MOCK_DURATION_MINUTES,
    codingRatio: DEFAULT_CODING_RATIO,
  },
  ...CURATED_MOCK_SIZES,
  {
    value: "kaggle-150",
    label: "Kaggle style · 3 kompetisi · 150 menit",
    count: 3,
    durationMinutes: 150,
    codingRatio: 1,
  },
  {
    value: "kaggle-300",
    label: "Final IOAI · 5 kompetisi · 5 jam",
    count: 5,
    durationMinutes: 300,
    codingRatio: 1,
  },
  {
    value: "final-day-1",
    label: FINAL_EKKA_PRESETS["final-day-1"].label,
    count: FINAL_EKKA_PRESETS["final-day-1"].count,
    durationMinutes: FINAL_EKKA_PRESETS["final-day-1"].durationMinutes,
    codingRatio: 0,
  },
  {
    value: "final-day-2",
    label: FINAL_EKKA_PRESETS["final-day-2"].label,
    count: FINAL_EKKA_PRESETS["final-day-2"].count,
    durationMinutes: FINAL_EKKA_PRESETS["final-day-2"].durationMinutes,
    codingRatio: 1,
  },
  {
    value: "kaggle",
    label: "Kaggle style · 3 kompetisi · 150 menit",
    count: 3,
    durationMinutes: 150,
    codingRatio: 1,
  },
];

export function parseAiMockSize(raw: unknown): AiMockSize {
  if (
    raw === "half" ||
    raw === "full" ||
    raw === "quick" ||
    raw === "kaggle" ||
    raw === "kaggle-150" ||
    raw === "kaggle-300" ||
    raw === "final-day-1" ||
    raw === "final-day-2"
  ) {
    return raw;
  }
  return "quick";
}

export function aiMockSizeMeta(size: AiMockSize) {
  return AI_MOCK_SIZES.find((s) => s.value === size) ?? AI_MOCK_SIZES[0]!;
}

/** Keep mcq/short_string as numeric-adjacent short-fill (plan: keep-all-migrate). */
export type AiMockAnswerType =
  | "numeric"
  | "mcq"
  | "short_string"
  | "python_output"
  | "codeSpec"
  | "notebook_submission";

export type AiMockSlot = {
  index: number;
  track: TrackId;
  topic: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  answerType: AiMockAnswerType;
  weight: number;
  /** Kaggle competition metric for this slot. */
  scoringMetric?: SubmissionScoringMode;
  /** Past IOAI catalog resource this slot is analogued from (year pack). */
  sourceResourceId?: string;
};

export type AiMockGenerationMode = "standard" | "custom" | "study-case";

export type AiMockCaseSlot = {
  caseIndex: number;
  /** Index into the flat problemIds array where this case starts. */
  startIndex: number;
  problemCount: number;
  track: TrackId;
  topic: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
};

export type AiMockPlanMeta = {
  generationMode: AiMockGenerationMode;
  difficultyMode: DifficultyMode;
  topicPrompt?: string;
  /** Persisted mock track field. */
  mockTrack: TrackId | "ALL";
  title: string;
  description: string;
  questionCount: number;
  durationMinutes: number;
  size: AiMockSize;
  codingCount: number;
  numericCount: number;
  /** User onboarding phase (persisted for display). */
  phase: Phase;
  /** Phase for IOAI refs + topic weighting during LLM generation. */
  generationPhase: Phase;
  /** standard exam vs kaggle competition vs hybrid Final Day 2. */
  examFormat: ExamFormat;
  /** Year-pack source year (kaggle-150 / kaggle-300 / final-day-2 notebooks). */
  ioaiYear?: IoaiPackYear;
  /** Explicit Final EKKA day profile when size is final-day-*. */
  finalEkkaProfile?: FinalEkkaPresetId;
};

/** IOAI reference context is skipped for pre-seleksi unless kaggle or phase difficulty. */
export function resolveGenerationPhase(
  userPhase: Phase,
  difficultyMode: DifficultyMode,
  isKaggle: boolean,
): Phase {
  if (difficultyMode === "final") return "final";
  if (difficultyMode === "semifinal") {
    if (userPhase === "pre-seleksi") return "semifinal";
    return userPhase === "final" ? "final" : "semifinal";
  }
  if (isKaggle && userPhase === "pre-seleksi") {
    return "final";
  }
  return userPhase;
}

/** Split total questions into study-case sizes of 3–5 that sum exactly. */
export function partitionStudyCaseSizes(total: number): number[] {
  const parts: number[] = [];
  let rem = Math.max(0, Math.floor(total));
  while (rem > 0) {
    if (rem >= 8) {
      parts.push(4);
      rem -= 4;
      continue;
    }
    if (rem === 7) {
      parts.push(4, 3);
      break;
    }
    if (rem === 6) {
      parts.push(3, 3);
      break;
    }
    if (rem >= 3 && rem <= 5) {
      parts.push(rem);
      break;
    }
    // rem is 1–2: fold into previous case when possible
    if (parts.length > 0) {
      const last = parts.pop()!;
      if (last + rem <= 5) {
        parts.push(last + rem);
      } else {
        parts.push(3, last + rem - 3);
      }
    } else {
      parts.push(3);
    }
    break;
  }
  return parts;
}

/** Non-coding short-fill rotation (numeric-heavy, keep mcq/short_string). */
const NUMERIC_ADJACENT: AiMockAnswerType[] = [
  "numeric",
  "mcq",
  "short_string",
  "numeric",
];

/**
 * Plan ~70% short-fill + ~30% coding (codeSpec), coding weight 2×.
 * Shuffle so coding slots are spread through the exam.
 */
export function planMockMix(
  total: number,
  opts?: {
    codingRatio?: number;
    codingWeight?: number;
    numericWeight?: number;
  },
): { answerType: AiMockAnswerType; weight: number }[] {
  const codingRatio = opts?.codingRatio ?? DEFAULT_CODING_RATIO;
  const codingWeight = opts?.codingWeight ?? DEFAULT_CODING_WEIGHT;
  const numericWeight = opts?.numericWeight ?? DEFAULT_NUMERIC_WEIGHT;
  const { codingCount, numericCount } = codingCountForTotal(total, codingRatio);

  const mix: { answerType: AiMockAnswerType; weight: number }[] = [];
  for (let i = 0; i < numericCount; i++) {
    mix.push({
      answerType: NUMERIC_ADJACENT[i % NUMERIC_ADJACENT.length]!,
      weight: numericWeight,
    });
  }
  for (let i = 0; i < codingCount; i++) {
    mix.push({ answerType: "codeSpec", weight: codingWeight });
  }

  // Fisher–Yates shuffle
  for (let i = mix.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = mix[i]!;
    mix[i] = mix[j]!;
    mix[j] = tmp;
  }
  return mix;
}

const TRACK_CYCLE = Object.keys(TRACKS) as TrackId[];

const ALL_ANSWER_TYPES: AiMockAnswerType[] = [
  "numeric",
  "mcq",
  "short_string",
  "python_output",
  "codeSpec",
  "notebook_submission",
];

export function buildAiMockPlan(params: {
  generationMode: AiMockGenerationMode;
  track: TrackId | "ALL";
  difficultyMode: DifficultyMode;
  topicPrompt?: string;
  preferredTopic?: string;
  size?: AiMockSize;
  phase?: Phase;
  /** IOAI year pack (kaggle-150 / kaggle-300 / final-day-2 notebooks). */
  ioaiYear?: IoaiPackYear | number | string;
}): { slots: AiMockSlot[]; cases: AiMockCaseSlot[]; meta: AiMockPlanMeta } {
  const phase = params.phase ?? "pre-seleksi";
  const size = params.size ?? "quick";
  const sizeMeta = aiMockSizeMeta(size);
  const isKaggle = isKaggleSize(size);
  const isFinalKaggle = isFinalKaggleSize(size);
  const finalPreset = isFinalEkkaSize(size) ? getFinalEkkaPreset(size) : null;
  const isFinalEkka = Boolean(finalPreset);
  const count = finalPreset?.count ?? sizeMeta.count;
  const durationMinutes =
    finalPreset?.durationMinutes ?? sizeMeta.durationMinutes;
  // Year pack for Kaggle sizes, and for Final Day 2 notebook analog inspiration.
  const wantsYearPack =
    isKaggle || (finalPreset?.id === "final-day-2");
  const ioaiYear: IoaiPackYear | undefined = wantsYearPack
    ? parseIoaiPackYear(params.ioaiYear ?? DEFAULT_IOAI_PACK_YEAR)
    : undefined;
  const yearPack = ioaiYear
    ? getIoaiYearPack(ioaiYear, isKaggle ? count : undefined)
    : null;
  // Past-paper analogs and Final EKKA presets use Final difficulty.
  const difficultyMode: DifficultyMode =
    isFinalKaggle || yearPack || isFinalEkka
      ? "final"
      : params.difficultyMode;
  // Kaggle / Final EKKA: study-case numeric packs do not apply.
  const generationMode: AiMockGenerationMode =
    (isKaggle || isFinalEkka) && params.generationMode === "study-case"
      ? "standard"
      : params.generationMode;
  const isStudyCase = generationMode === "study-case";
  const restrictToSemifinalTopics = difficultyMode === "semifinal";
  const restrictToIoaiSyllabus = difficultyMode === "final";

  let track: TrackId =
    params.track !== "ALL" && TRACKS[params.track] ? params.track : "B";
  const topicPairs =
    generationMode === "custom" && params.topicPrompt
      ? topicPairsFromPrompt(
          params.topicPrompt,
          TRACKS[track] ? track : "B",
        )
      : null;

  if (topicPairs && topicPairs.length > 0) {
    track = topicPairs[0]!.track;
  }

  // Final EKKA: fixed provisional slot mix. Kaggle: all notebooks.
  // Study-case: numeric-adjacent. Else ~70:30 mix.
  const mix = finalPreset
    ? finalPreset.slots.map((s) => ({
        answerType: s.answerType as AiMockAnswerType,
        weight: s.weight,
      }))
    : isKaggle
      ? Array.from({ length: count }, () => ({
          answerType: "notebook_submission" as const,
          weight: KAGGLE_CODING_WEIGHT,
        }))
      : isStudyCase
        ? Array.from({ length: count }, (_, i) => ({
            answerType: NUMERIC_ADJACENT[i % NUMERIC_ADJACENT.length]!,
            weight: DEFAULT_NUMERIC_WEIGHT,
          }))
        : planMockMix(count, {
            codingRatio: sizeMeta.codingRatio,
          });

  const codingCounts = finalPreset
    ? finalEkkaCodingCounts(finalPreset)
    : isKaggle
      ? { codingCount: count, numericCount: 0, notebookCount: count }
      : {
          ...codingCountForTotal(count, sizeMeta.codingRatio),
          notebookCount: 0,
        };
  const { codingCount, numericCount } = codingCounts;

  const generationPhase = resolveGenerationPhase(
    phase,
    difficultyMode,
    isKaggle || isFinalEkka,
  );

  const allTopics = (Object.keys(TRACKS) as TrackId[]).flatMap(
    (t) => TRACKS[t].topics,
  );

  // For Final Day 2, map notebook slots onto year-pack papers (if available).
  const notebookSlotIndexes = mix
    .map((m, i) => (m.answerType === "notebook_submission" ? i : -1))
    .filter((i) => i >= 0);
  let notebookPackCursor = 0;

  const slots: AiMockSlot[] = [];
  for (let i = 0; i < count; i++) {
    const difficulty = resolveDifficulty(difficultyMode);
    let questionTrack = track;
    let topic: string;
    let sourceResourceId: string | undefined;

    const slotMix = mix[i]!;
    const isNotebookSlot = slotMix.answerType === "notebook_submission";

    if (isKaggle && yearPack && yearPack[i]) {
      const packSlot = yearPack[i]!;
      questionTrack = packSlot.track;
      topic = packSlot.topic;
      sourceResourceId = packSlot.resourceId;
    } else if (
      isFinalEkka &&
      isNotebookSlot &&
      yearPack &&
      yearPack.length > 0
    ) {
      const packSlot =
        yearPack[notebookPackCursor % yearPack.length]!;
      notebookPackCursor += 1;
      questionTrack = packSlot.track;
      topic = packSlot.topic;
      sourceResourceId = packSlot.resourceId;
    } else if (topicPairs && topicPairs.length > 0) {
      const pair = topicPairs[i % topicPairs.length]!;
      questionTrack = pair.track;
      topic = pair.topic;
    } else if (
      restrictToIoaiSyllabus &&
      (isFinalKaggle || isFinalEkka || params.track === "ALL")
    ) {
      // Final IOAI / Final EKKA: rotate domains across full syllabus.
      topic = pickIoaiSyllabusTopic(allTopics, i, params.preferredTopic);
      questionTrack =
        trackForIoaiTopic(topic) ?? TRACK_CYCLE[i % TRACK_CYCLE.length]!;
    } else if (
      params.track === "ALL" &&
      (generationMode === "standard" || isStudyCase)
    ) {
      questionTrack = TRACK_CYCLE[i % TRACK_CYCLE.length]!;
      topic = pickTopicForTrack(
        questionTrack,
        generationPhase,
        params.preferredTopic,
        {
          restrictToSemifinalTopics,
          restrictToIoaiSyllabus,
          slotIndex: i,
        },
      );
    } else {
      topic = pickTopicForTrack(track, generationPhase, params.preferredTopic, {
        restrictToSemifinalTopics,
        restrictToIoaiSyllabus,
        slotIndex: i,
      });
    }

    slots.push({
      index: i,
      track: questionTrack,
      topic,
      difficulty,
      answerType: slotMix.answerType,
      weight: slotMix.weight,
      scoringMetric:
        isNotebookSlot
          ? KAGGLE_SLOT_METRICS[
              (isKaggle ? i : notebookSlotIndexes.indexOf(i)) %
                KAGGLE_SLOT_METRICS.length
            ]
          : undefined,
      sourceResourceId,
    });
  }

  const cases: AiMockCaseSlot[] = [];
  if (isStudyCase) {
    const sizes = partitionStudyCaseSizes(count);
    let start = 0;
    for (let c = 0; c < sizes.length; c++) {
      const problemCount = sizes[c]!;
      const anchor = slots[start]!;
      cases.push({
        caseIndex: c,
        startIndex: start,
        problemCount,
        track: anchor.track,
        topic: anchor.topic,
        difficulty: anchor.difficulty,
      });
      start += problemCount;
    }
  }

  const preferred = params.topicPrompt
    ? matchTopicsFromPrompt(params.topicPrompt)
    : [];

  const resolvedMockTrack: TrackId | "ALL" =
    generationMode === "custom" ||
    params.track === "ALL" ||
    Boolean(yearPack && isKaggle) ||
    isFinalEkka ||
    (restrictToIoaiSyllabus && isFinalKaggle)
      ? "ALL"
      : track;

  const packTaskNames = yearPack?.map((s) => s.title) ?? [];
  const title = buildNaturalMockTitle({
    kind: "ai",
    generationMode: generationMode === "custom" ? "custom" : "standard",
    track: resolvedMockTrack,
    difficultyMode,
    count,
    size,
    ioaiYear,
    topicLabels: isStudyCase
      ? ["Studi kasus PREDIKSI"]
      : preferred.length > 0
        ? preferred.slice(0, 3).map((t) => TOPIC_LABELS[t] ?? t)
        : undefined,
    topicPrompt: isStudyCase
      ? "Studi kasus PREDIKSI"
      : params.topicPrompt,
  });
  const description = finalPreset
    ? finalPreset.description
    : yearPack && ioaiYear
      ? `Analog paper resmi (IOAI ${ioaiYear}). ${count} kompetisi notebook · ${durationMinutes} menit${isFinalKaggle ? " / 5 jam" : ""}. Inspirasi: ${packTaskNames.join("; ")}. Orisinal (bukan soal/dataset resmi). Kerjakan di tab Notebook, Submit CSV.`
      : isFinalKaggle
        ? `${count} kompetisi notebook gaya Kaggle/IOAI (${durationMinutes} menit / 5 jam). Satu kompetisi per pilar silabus IOAI. Kerjakan di tab Notebook platform, Submit CSV untuk dinilai.`
        : isKaggle
          ? `${count} kompetisi notebook gaya Kaggle/IOAI (${durationMinutes} menit). Kerjakan di tab Notebook platform, Submit CSV untuk dinilai.`
          : isStudyCase
            ? `${count} soal AI dalam paket studi kasus PREDIKSI terkait (${durationMinutes} menit).`
            : generationMode === "custom" && params.topicPrompt
              ? `${count} soal AI bersama (${durationMinutes} menit) mengikuti brief: ${params.topicPrompt.slice(0, 180)}`
              : `${count} soal AI baru (${durationMinutes} menit; ~${numericCount} isian + ~${codingCount} coding). Dibuat otomatis; dapat dikerjakan semua siswa.`;

  return {
    slots,
    cases,
    meta: {
      generationMode,
      difficultyMode,
      topicPrompt: params.topicPrompt,
      mockTrack: resolvedMockTrack,
      title,
      description,
      questionCount: count,
      durationMinutes,
      size,
      codingCount: isStudyCase
        ? 0
        : codingCount + (codingCounts.notebookCount ?? 0),
      numericCount: isStudyCase ? count : numericCount,
      phase,
      generationPhase,
      examFormat: finalPreset
        ? finalPreset.examFormat
        : isKaggle
          ? "kaggle"
          : "standard",
      ioaiYear,
      finalEkkaProfile: finalPreset?.id,
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
  if (!ALL_ANSWER_TYPES.includes(answerType as AiMockAnswerType)) return false;
  if (![1, 2, 3, 4, 5].includes(difficulty)) return false;
  return true;
}
