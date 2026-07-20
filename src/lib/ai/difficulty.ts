export type DifficultyMode = "easy" | "medium" | "hard" | "normal";

export const DIFFICULTY_MODES: {
  value: DifficultyMode;
  label: string;
}[] = [
  { value: "easy", label: "Mudah" },
  { value: "medium", label: "Sedang" },
  { value: "hard", label: "Sulit" },
  { value: "normal", label: "Distribusi normal" },
];

/** Discrete normal-ish weights centered on medium (3). */
const NORMAL_WEIGHTS: { level: 1 | 2 | 3 | 4 | 5; weight: number }[] = [
  { level: 1, weight: 10 },
  { level: 2, weight: 20 },
  { level: 3, weight: 40 },
  { level: 4, weight: 20 },
  { level: 5, weight: 10 },
];

export function resolveDifficulty(mode: DifficultyMode): 1 | 2 | 3 | 4 | 5 {
  if (mode === "easy") return 1;
  if (mode === "medium") return 3;
  if (mode === "hard") return 5;
  const total = NORMAL_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let roll = Math.random() * total;
  for (const entry of NORMAL_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.level;
  }
  return 3;
}

export function parseDifficultyMode(raw: unknown): DifficultyMode {
  const value = String(raw ?? "medium");
  if (
    value === "easy" ||
    value === "medium" ||
    value === "hard" ||
    value === "normal"
  ) {
    return value;
  }
  return "medium";
}

export function labelDifficultyMode(mode: DifficultyMode) {
  return DIFFICULTY_MODES.find((d) => d.value === mode)?.label ?? mode;
}
