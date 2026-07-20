export type CuratedMockSize = "half" | "full";

export const CURATED_MOCK_SIZES: {
  value: CuratedMockSize;
  label: string;
  count: number;
  durationMinutes: number;
}[] = [
  { value: "half", label: "20 soal · 60 menit", count: 20, durationMinutes: 60 },
  { value: "full", label: "40 soal · 120 menit", count: 40, durationMinutes: 120 },
];
