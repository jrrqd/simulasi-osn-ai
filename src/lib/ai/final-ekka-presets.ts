import {
  DEFAULT_CODING_WEIGHT,
  DEFAULT_NUMERIC_WEIGHT,
} from "@/lib/ai/curated-mock-size";
import type { ExamFormat } from "@/lib/content/types";

/** Slot answer types used by Final EKKA presets (mirrors AiMockAnswerType). */
export type FinalEkkaAnswerType =
  | "numeric"
  | "mcq"
  | "short_string"
  | "python_output"
  | "codeSpec"
  | "notebook_submission";

/**
 * Final EKKA 2026 dedicated mock presets.
 *
 * Confirmed from the participant booklet (Buku Saku Final EKKA 2026):
 * - Day 1 (16 Sep): Tes Problem Solving AI · 08.00–13.00 WIB (5 jam)
 * - Day 2 (17 Sep): Tes Programming · 08.00–13.00 WIB (5 jam)
 *
 * Counts, answer-type mixes, and weights below are APP DEFAULTS
 * (komposisi sementara) until the technical meeting publishes official
 * juknis. Keep all tunable values in this module only.
 */

export const FINAL_EKKA_DURATION_MINUTES = 300;

export const FINAL_EKKA_PRESET_IDS = ["final-day-1", "final-day-2"] as const;
export type FinalEkkaPresetId = (typeof FINAL_EKKA_PRESET_IDS)[number];

export type FinalEkkaSlotSpec = {
  answerType: FinalEkkaAnswerType;
  weight: number;
};

export type FinalEkkaPreset = {
  id: FinalEkkaPresetId;
  /** Size key used by AiMockSize / generate-mock. */
  size: FinalEkkaPresetId;
  label: string;
  shortLabel: string;
  dayLabel: string;
  testName: string;
  dateLabel: string;
  description: string;
  provisionalNote: string;
  count: number;
  durationMinutes: number;
  examFormat: ExamFormat;
  /** Forced difficulty mode for generation. */
  difficultyMode: "final";
  /** Slot mix in exam order (not shuffled — keeps programming/notebook cadence). */
  slots: FinalEkkaSlotSpec[];
};

const KAGGLE_WEIGHT = 5;

/** Day 1: deep short-fill problem solving (no notebook / long coding). */
const DAY1_SLOTS: FinalEkkaSlotSpec[] = Array.from({ length: 20 }, (_, i) => {
  const rotation: FinalEkkaAnswerType[] = [
    "numeric",
    "mcq",
    "short_string",
    "numeric",
    "python_output",
  ];
  return {
    answerType: rotation[i % rotation.length]!,
    weight: DEFAULT_NUMERIC_WEIGHT,
  };
});

/** Day 2: mixed programming — 3 codeSpec + 2 notebook competitions. */
const DAY2_SLOTS: FinalEkkaSlotSpec[] = [
  { answerType: "codeSpec", weight: DEFAULT_CODING_WEIGHT },
  { answerType: "notebook_submission", weight: KAGGLE_WEIGHT },
  { answerType: "codeSpec", weight: DEFAULT_CODING_WEIGHT },
  { answerType: "notebook_submission", weight: KAGGLE_WEIGHT },
  { answerType: "codeSpec", weight: DEFAULT_CODING_WEIGHT },
];

export const FINAL_EKKA_PRESETS: Record<FinalEkkaPresetId, FinalEkkaPreset> = {
  "final-day-1": {
    id: "final-day-1",
    size: "final-day-1",
    label: "Final EKKA · Hari 1 · Problem Solving · 5 jam",
    shortLabel: "Hari 1 · Problem Solving",
    dayLabel: "Hari 1",
    testName: "Tes Problem Solving AI",
    dateLabel: "16 September 2026",
    description:
      "Simulasi Final EKKA 2026 Hari 1 (Tes Problem Solving AI). 5 jam · komposisi sementara 20 soal reasoning/hitungan/interpretasi model (isian ketat). Bukan juknis resmi — menunggu technical meeting.",
    provisionalNote:
      "Jumlah soal & format sementara sampai juknis Final resmi.",
    count: 20,
    durationMinutes: FINAL_EKKA_DURATION_MINUTES,
    examFormat: "standard",
    difficultyMode: "final",
    slots: DAY1_SLOTS,
  },
  "final-day-2": {
    id: "final-day-2",
    size: "final-day-2",
    label: "Final EKKA · Hari 2 · Programming · 5 jam",
    shortLabel: "Hari 2 · Programming",
    dayLabel: "Hari 2",
    testName: "Tes Programming",
    dateLabel: "17 September 2026",
    description:
      "Simulasi Final EKKA 2026 Hari 2 (Tes Programming). 5 jam · komposisi sementara 3 coding (codeSpec) + 2 kompetisi notebook/CSV. Bukan juknis resmi — menunggu technical meeting.",
    provisionalNote:
      "Jumlah & mix coding/notebook sementara sampai juknis Final resmi.",
    count: 5,
    durationMinutes: FINAL_EKKA_DURATION_MINUTES,
    examFormat: "hybrid",
    difficultyMode: "final",
    slots: DAY2_SLOTS,
  },
};

export function isFinalEkkaPresetId(
  value: unknown,
): value is FinalEkkaPresetId {
  return (
    value === "final-day-1" ||
    value === "final-day-2"
  );
}

export function getFinalEkkaPreset(
  id: FinalEkkaPresetId,
): FinalEkkaPreset {
  return FINAL_EKKA_PRESETS[id];
}

export function parseFinalEkkaPresetId(
  raw: unknown,
): FinalEkkaPresetId | null {
  return isFinalEkkaPresetId(raw) ? raw : null;
}

/** Generation profile passed into problem prompts. */
export type FinalEkkaGenerationProfile = FinalEkkaPresetId;

export function finalEkkaCodingCounts(preset: FinalEkkaPreset): {
  codingCount: number;
  numericCount: number;
  notebookCount: number;
} {
  let codingCount = 0;
  let numericCount = 0;
  let notebookCount = 0;
  for (const slot of preset.slots) {
    if (slot.answerType === "notebook_submission") notebookCount += 1;
    else if (slot.answerType === "codeSpec" || slot.answerType === "python_output") {
      codingCount += 1;
    } else {
      numericCount += 1;
    }
  }
  return { codingCount, numericCount, notebookCount };
}
