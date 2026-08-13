export type DifficultyMode =
  | "easy"
  | "medium"
  | "hard"
  | "semifinal"
  | "final"
  | "normal";

export const DIFFICULTY_MODES: {
  value: DifficultyMode;
  label: string;
}[] = [
  { value: "easy", label: "Mudah" },
  { value: "medium", label: "Sedang" },
  { value: "hard", label: "Sulit" },
  { value: "semifinal", label: "Semifinal" },
  { value: "final", label: "Final (IOAI)" },
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

/** Semifinal mock bias: D4/D5 ~80%, D3 ~20%, no D1/D2. */
const SEMIFINAL_WEIGHTS: { level: 1 | 2 | 3 | 4 | 5; weight: number }[] = [
  { level: 3, weight: 20 },
  { level: 4, weight: 40 },
  { level: 5, weight: 40 },
];

/** Final (IOAI) mock bias: D5 ~85%, D4 ~15%, no D1–D3. */
const FINAL_WEIGHTS: { level: 1 | 2 | 3 | 4 | 5; weight: number }[] = [
  { level: 4, weight: 15 },
  { level: 5, weight: 85 },
];

function pickWeightedLevel(
  weights: { level: 1 | 2 | 3 | 4 | 5; weight: number }[],
  fallback: 1 | 2 | 3 | 4 | 5,
): 1 | 2 | 3 | 4 | 5 {
  const total = weights.reduce((s, w) => s + w.weight, 0);
  let roll = Math.random() * total;
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) return entry.level;
  }
  return fallback;
}

export function resolveDifficulty(mode: DifficultyMode): 1 | 2 | 3 | 4 | 5 {
  if (mode === "easy") return 1;
  if (mode === "medium") return 3;
  if (mode === "hard") return 5;
  if (mode === "semifinal") return pickWeightedLevel(SEMIFINAL_WEIGHTS, 4);
  if (mode === "final") return pickWeightedLevel(FINAL_WEIGHTS, 5);
  return pickWeightedLevel(NORMAL_WEIGHTS, 3);
}

export function parseDifficultyMode(raw: unknown): DifficultyMode {
  const value = String(raw ?? "medium");
  if (
    value === "easy" ||
    value === "medium" ||
    value === "hard" ||
    value === "semifinal" ||
    value === "final" ||
    value === "normal"
  ) {
    return value;
  }
  return "medium";
}

export function labelDifficultyMode(mode: DifficultyMode) {
  return DIFFICULTY_MODES.find((d) => d.value === mode)?.label ?? mode;
}

/** Library display bands: Mudah / Normal / Hard. */
export type DifficultyBand = "easy" | "normal" | "hard";

export function difficultyBand(difficulty: number): DifficultyBand {
  if (difficulty <= 1) return "easy";
  if (difficulty <= 3) return "normal";
  return "hard";
}

/** Bank-soal labels: Mudah / Normal / Semifinal (D4–D5). */
export function labelDifficultyBand(difficulty: number): string {
  if (difficulty <= 1) return "Mudah";
  if (difficulty <= 3) return "Normal";
  return "Semifinal";
}

/** Text color for library difficulty labels. */
export function difficultyBandTextClass(difficulty: number): string {
  const band = difficultyBand(difficulty);
  if (band === "easy") return "text-[var(--ok)]";
  if (band === "hard") return "text-[var(--bad)]";
  return "text-[var(--ink)]";
}

/** Map mock difficultyMode to Mudah / Normal / Sulit display band. */
export function difficultyModeBand(mode: DifficultyMode): DifficultyBand {
  if (mode === "easy") return "easy";
  if (mode === "hard" || mode === "semifinal" || mode === "final") return "hard";
  return "normal";
}

export function labelDifficultyModeBand(mode: DifficultyMode): string {
  if (mode === "semifinal") return "Semifinal";
  if (mode === "final") return "Final";
  const band = difficultyModeBand(mode);
  if (band === "easy") return "Mudah";
  if (band === "hard") return "Sulit";
  return "Normal";
}

export function difficultyModeTextClass(mode: DifficultyMode): string {
  const band = difficultyModeBand(mode);
  if (band === "easy") return "text-[var(--ok)]";
  if (band === "hard") return "text-[var(--bad)]";
  return "text-[var(--ink)]";
}
