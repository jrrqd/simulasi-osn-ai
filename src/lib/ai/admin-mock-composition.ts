/**
 * Admin helpers for composing OSN AI 2026-style mock exams.
 * Reuses planMockMix for 70:30 numeric:coding with 2:1 weights.
 */

import {
  KAGGLE_CODING_WEIGHT,
  isFinalEkkaSize,
  isKaggleSize,
  planMockMix,
  type AiMockAnswerType,
  type AiMockSize,
  aiMockSizeMeta,
} from "@/lib/ai/ai-mock-plan";
import {
  DEFAULT_CODING_RATIO,
  DEFAULT_CODING_WEIGHT,
  DEFAULT_NUMERIC_WEIGHT,
  codingCountForTotal,
} from "@/lib/ai/curated-mock-size";
import {
  finalEkkaCodingCounts,
  getFinalEkkaPreset,
} from "@/lib/ai/final-ekka-presets";

export type MockCompositionPreview = {
  size: AiMockSize;
  total: number;
  durationMinutes: number;
  codingRatio: number;
  codingCount: number;
  numericCount: number;
  notebookCount?: number;
  codingWeightEach: number;
  numericWeightEach: number;
  totalWeight: number;
  slots: { answerType: AiMockAnswerType; weight: number }[];
};

export function previewMockComposition(params: {
  size?: AiMockSize;
  codingRatio?: number;
  codingWeight?: number;
  numericWeight?: number;
}): MockCompositionPreview {
  const size = params.size ?? "quick";
  const meta = aiMockSizeMeta(size);

  if (isFinalEkkaSize(size)) {
    const preset = getFinalEkkaPreset(size);
    const counts = finalEkkaCodingCounts(preset);
    const slots = preset.slots.map((s) => ({
      answerType: s.answerType as AiMockAnswerType,
      weight: s.weight,
    }));
    const totalWeight = slots.reduce((sum, s) => sum + s.weight, 0);
    return {
      size,
      total: preset.count,
      durationMinutes: preset.durationMinutes,
      codingRatio:
        preset.count === 0
          ? 0
          : (counts.codingCount + counts.notebookCount) / preset.count,
      codingCount: counts.codingCount,
      numericCount: counts.numericCount,
      notebookCount: counts.notebookCount,
      codingWeightEach: DEFAULT_CODING_WEIGHT,
      numericWeightEach: DEFAULT_NUMERIC_WEIGHT,
      totalWeight,
      slots,
    };
  }

  if (isKaggleSize(size)) {
    const slots = Array.from({ length: meta.count }, () => ({
      answerType: "notebook_submission" as const,
      weight: KAGGLE_CODING_WEIGHT,
    }));
    return {
      size,
      total: meta.count,
      durationMinutes: meta.durationMinutes,
      codingRatio: 1,
      codingCount: 0,
      numericCount: 0,
      notebookCount: meta.count,
      codingWeightEach: KAGGLE_CODING_WEIGHT,
      numericWeightEach: DEFAULT_NUMERIC_WEIGHT,
      totalWeight: meta.count * KAGGLE_CODING_WEIGHT,
      slots,
    };
  }

  const codingRatio =
    params.codingRatio ?? meta.codingRatio ?? DEFAULT_CODING_RATIO;
  const codingWeight = params.codingWeight ?? DEFAULT_CODING_WEIGHT;
  const numericWeight = params.numericWeight ?? DEFAULT_NUMERIC_WEIGHT;
  const { codingCount, numericCount } = codingCountForTotal(
    meta.count,
    codingRatio,
  );
  const slots = planMockMix(meta.count, {
    codingRatio,
    codingWeight,
    numericWeight,
  });
  return {
    size,
    total: meta.count,
    durationMinutes: meta.durationMinutes,
    codingRatio,
    codingCount,
    numericCount,
    notebookCount: 0,
    codingWeightEach: codingWeight,
    numericWeightEach: numericWeight,
    totalWeight: codingCount * codingWeight + numericCount * numericWeight,
    slots,
  };
}

export function formatCompositionLabel(preview: MockCompositionPreview): string {
  if ((preview.notebookCount ?? 0) > 0 && preview.codingCount > 0) {
    return `${preview.codingCount} coding × ${preview.codingWeightEach} + ${preview.notebookCount} notebook × 5 = ${preview.totalWeight} poin · ${preview.durationMinutes} menit`;
  }
  if ((preview.notebookCount ?? 0) > 0) {
    return `${preview.notebookCount} notebook × 5 = ${preview.totalWeight} poin · ${preview.durationMinutes} menit`;
  }
  return `${preview.numericCount} isian × ${preview.numericWeightEach} + ${preview.codingCount} coding × ${preview.codingWeightEach} = ${preview.totalWeight} poin · ${preview.durationMinutes} menit`;
}
