/**
 * Admin helpers for composing OSN AI 2026-style mock exams.
 * Reuses planMockMix for 70:30 numeric:coding with 2:1 weights.
 */

import {
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

export type MockCompositionPreview = {
  size: AiMockSize;
  total: number;
  durationMinutes: number;
  codingRatio: number;
  codingCount: number;
  numericCount: number;
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
  const codingRatio = params.codingRatio ?? meta.codingRatio ?? DEFAULT_CODING_RATIO;
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
    codingWeightEach: codingWeight,
    numericWeightEach: numericWeight,
    totalWeight: codingCount * codingWeight + numericCount * numericWeight,
    slots,
  };
}

export function formatCompositionLabel(preview: MockCompositionPreview): string {
  return `${preview.numericCount} isian × ${preview.numericWeightEach} + ${preview.codingCount} coding × ${preview.codingWeightEach} = ${preview.totalWeight} poin · ${preview.durationMinutes} menit`;
}
