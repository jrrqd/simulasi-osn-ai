export type CuratedMockSize = "half" | "full";

export const DEFAULT_CODING_RATIO = 0.3;
export const DEFAULT_CODING_WEIGHT = 2;
export const DEFAULT_NUMERIC_WEIGHT = 1;

export const CURATED_MOCK_SIZES: {
  value: CuratedMockSize;
  label: string;
  count: number;
  durationMinutes: number;
  codingRatio: number;
}[] = [
  {
    value: "half",
    label: "20 soal · 60 menit",
    count: 20,
    durationMinutes: 60,
    codingRatio: DEFAULT_CODING_RATIO,
  },
  {
    value: "full",
    label: "40 soal · 150 menit",
    count: 40,
    durationMinutes: 150,
    codingRatio: DEFAULT_CODING_RATIO,
  },
];

export const TOPIC_PROMPT_MAX_LEN = 500;
export const TOPIC_PROMPT_MIN_LEN = 8;

/** Compute coding vs non-coding counts for a mock size (OSN AI 2026 ~70:30). */
export function codingCountForTotal(
  total: number,
  codingRatio = DEFAULT_CODING_RATIO,
): { codingCount: number; numericCount: number } {
  const codingCount = Math.min(
    total,
    Math.max(total >= 4 ? 2 : 1, Math.round(total * codingRatio)),
  );
  return { codingCount, numericCount: total - codingCount };
}
