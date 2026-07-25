import { rankGaps } from "@/lib/analytics/mastery";
import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";
import { masteryFill } from "@/lib/charts/mastery-color";

export type ReadinessLevel =
  | "not_started"
  | "not_ready"
  | "needs_practice"
  | "developing"
  | "almost_ready"
  | "ready";

export type ReadinessTopic = {
  topic: string;
  track: string;
  mastery: number;
  attemptsCount: number;
};

export type OsnReadiness = {
  score: number;
  label: string;
  level: ReadinessLevel;
  color: string;
  factors: {
    mastery: number;
    mockScore: number;
    coverage: number;
    mockVolume: number;
  };
  topGaps: { topic: string; label: string; mastery: number }[];
};

function levelForScore(
  score: number,
  notStarted: boolean,
): { level: ReadinessLevel; label: string } {
  if (notStarted) return { level: "not_started", label: "Belum mulai" };
  if (score <= 24) return { level: "not_ready", label: "Belum siap" };
  if (score <= 49) return { level: "needs_practice", label: "Perlu latihan" };
  if (score <= 74) return { level: "developing", label: "Berkembang" };
  if (score <= 89) return { level: "almost_ready", label: "Hampir siap" };
  return { level: "ready", label: "Siap OSN AI" };
}

/** Build full syllabus topic rows (unattempted → mastery 0). */
export function syllabusTopicsFromMastery(
  masteryRows: { topic: string; mastery: number; attemptsCount?: number }[],
): ReadinessTopic[] {
  return Object.entries(TRACKS).flatMap(([track, meta]) =>
    meta.topics.map((topic) => {
      const row = masteryRows.find((m) => m.topic === topic);
      return {
        track,
        topic,
        mastery: row?.mastery ?? 0,
        attemptsCount: row?.attemptsCount ?? 0,
      };
    }),
  );
}

export function computeOsnReadiness(input: {
  topics: ReadinessTopic[];
  avgMockScoreRatio: number;
  completedMocks: number;
  attemptsCount: number;
}): OsnReadiness {
  const allTopics = input.topics.length
    ? input.topics
    : syllabusTopicsFromMastery([]);
  const totalTopics = allTopics.length || 1;
  const attempted = allTopics.filter((t) => t.attemptsCount > 0);
  const notStarted =
    input.attemptsCount === 0 && input.completedMocks === 0;

  // Mean mastery over syllabus (unattempted count as 0)
  const masteryPct =
    (allTopics.reduce((sum, t) => sum + t.mastery, 0) / totalTopics) * 100;
  const mockScorePct = Math.max(0, Math.min(1, input.avgMockScoreRatio)) * 100;
  const coveragePct = (attempted.length / totalTopics) * 100;
  const mockVolumePct = Math.min(input.completedMocks / 3, 1) * 100;

  const raw =
    0.45 * masteryPct +
    0.35 * mockScorePct +
    0.15 * coveragePct +
    0.05 * mockVolumePct;
  const score = notStarted ? 0 : Math.round(Math.max(0, Math.min(100, raw)));

  const { level, label } = levelForScore(score, notStarted);
  const gaps = rankGaps(
    allTopics.map((t) => ({
      topic: t.topic,
      track: t.track as TrackId | string,
      mastery: t.mastery,
      attemptsCount: t.attemptsCount,
    })),
  )
    .slice(0, 3)
    .map((g) => ({
      topic: g.topic,
      label: TOPIC_LABELS[g.topic] ?? g.topic,
      mastery: g.mastery,
    }));

  return {
    score,
    label,
    level,
    color: masteryFill(score),
    factors: {
      mastery: Math.round(masteryPct),
      mockScore: Math.round(mockScorePct),
      coverage: Math.round(coveragePct),
      mockVolume: Math.round(mockVolumePct),
    },
    topGaps: gaps,
  };
}
