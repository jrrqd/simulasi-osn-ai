import type { TrackId } from "@/lib/content/types";

export type AttemptLike = {
  topic: string;
  track: string;
  difficulty: number;
  score: number;
  maxScore: number;
  durationMs: number;
  isCorrect: boolean;
  source?: string;
  createdAt: Date | string;
};

function daysAgo(date: Date) {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

export function computeTopicMastery(attempts: AttemptLike[]) {
  if (attempts.length === 0) {
    return {
      mastery: 0,
      attemptsCount: 0,
      correctCount: 0,
      avgDurationMs: 0,
    };
  }

  let weighted = 0;
  let weightSum = 0;
  let durationSum = 0;
  let correctCount = 0;

  const sorted = [...attempts].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  sorted.forEach((a, idx) => {
    const age = daysAgo(new Date(a.createdAt));
    const recency = Math.exp(-age / 21);
    const difficulty = 0.7 + a.difficulty * 0.15;
    const sourceWeight = a.source === "ai" ? 0.75 : 1;
    const repeatPenalty = 1 / (1 + idx * 0.05);
    const ratio = a.maxScore === 0 ? 0 : a.score / a.maxScore;
    const w = recency * difficulty * sourceWeight * repeatPenalty;
    weighted += ratio * w;
    weightSum += w;
    durationSum += a.durationMs;
    if (a.isCorrect) correctCount += 1;
  });

  return {
    mastery: weightSum === 0 ? 0 : Math.min(1, weighted / weightSum),
    attemptsCount: attempts.length,
    correctCount,
    avgDurationMs: Math.round(durationSum / attempts.length),
  };
}

export function rankGaps(
  masteryByTopic: {
    topic: string;
    track: TrackId | string;
    mastery: number;
    attemptsCount: number;
  }[],
) {
  return [...masteryByTopic]
    .map((t) => ({
      ...t,
      gapScore:
        (1 - t.mastery) * (t.attemptsCount === 0 ? 1.25 : 1) +
        (t.attemptsCount < 3 ? 0.15 : 0),
    }))
    .sort((a, b) => b.gapScore - a.gapScore);
}

export function overallMastery(
  items: { mastery: number; attemptsCount: number }[],
) {
  const active = items.filter((i) => i.attemptsCount > 0);
  if (active.length === 0) return 0;
  return active.reduce((s, i) => s + i.mastery, 0) / active.length;
}
