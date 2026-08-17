import ioaiData from "../../../content/resources/ioai-index.json";
import { trackForIoaiTopic } from "@/lib/content/ioai-syllabus";
import type { IoaiResource } from "@/lib/content/resource-types";
import { TRACKS, type TrackId } from "@/lib/content/types";

/** Curated Latihan problem id for a year-pack catalog resource. */
export function practiceProblemIdForResource(resourceId: string): string {
  return `p-analog-${resourceId}`;
}

/** Official IOAI years with in-app Final analog packs. */
export const IOAI_PACK_YEARS = [2024, 2025, 2026] as const;
export type IoaiPackYear = (typeof IOAI_PACK_YEARS)[number];

/** Default year for Final IOAI year-pack UI / API. */
export const DEFAULT_IOAI_PACK_YEAR: IoaiPackYear = 2026;

/**
 * Exactly 5 catalog resource IDs per year.
 * Tasks chosen for reasonable tabular/CSV analogs (skip Pixel, IOAI Field, etc.).
 */
export const IOAI_YEAR_PACK_IDS: Record<IoaiPackYear, readonly string[]> = {
  2024: [
    "ioai-2024-athome-ml",
    "ioai-2024-athome-nlp",
    "ioai-2024-athome-cv",
    "ioai-2024-onsite-ml",
    "ioai-2024-onsite-nlp",
  ],
  2025: [
    "ioai-2025-radar",
    "ioai-2025-chicken",
    "ioai-2025-concepts",
    "ioai-2025-restroom",
    "ioai-2025-antique",
  ],
  2026: [
    "ioai-2026-find-order",
    "ioai-2026-robot-chasing",
    "ioai-2026-potato",
    "ioai-2026-double-agent",
    "ioai-2026-ghost",
  ],
};

const JSON_BY_ID = new Map<string, IoaiResource>();
for (const raw of ioaiData as unknown as IoaiResource[]) {
  if (raw && typeof raw.id === "string") {
    JSON_BY_ID.set(raw.id, raw);
  }
}

export function parseIoaiPackYear(raw: unknown): IoaiPackYear {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (n === 2024 || n === 2025 || n === 2026) return n;
  return DEFAULT_IOAI_PACK_YEAR;
}

export function isIoaiPackYear(raw: unknown): raw is IoaiPackYear {
  return raw === 2024 || raw === 2025 || raw === 2026;
}

/** Static catalog lookup (no DB) — used for planning + UI lists. */
export function getCatalogResource(id: string): IoaiResource | null {
  return JSON_BY_ID.get(id) ?? null;
}

export type IoaiYearPackSlot = {
  resourceId: string;
  title: string;
  topic: string;
  track: TrackId;
  summary: string;
  promptHint?: string;
  /** In-app Latihan Kaggle analog problem id. */
  practiceProblemId: string;
};

function resolveTopic(resource: IoaiResource): string {
  for (const t of resource.topics) {
    for (const track of Object.keys(TRACKS) as TrackId[]) {
      if (TRACKS[track].topics.includes(t)) return t;
    }
  }
  return "supervised-learning";
}

function resolveTrack(topic: string, slotIndex: number): TrackId {
  return (
    trackForIoaiTopic(topic) ??
    (["A", "B", "C", "D"] as TrackId[])[slotIndex % 4]!
  );
}

/** Resolve pack slots for a year from static catalog (default 5; pass 3 for Kaggle 150). */
export function getIoaiYearPack(
  year: IoaiPackYear,
  count: number = 5,
): IoaiYearPackSlot[] {
  const ids = IOAI_YEAR_PACK_IDS[year];
  const n = Math.min(Math.max(1, Math.floor(count)), ids.length);
  return ids.slice(0, n).map((id, i) => {
    const resource = getCatalogResource(id);
    if (!resource) {
      throw new Error(`IOAI year pack ${year}: missing catalog id ${id}`);
    }
    const topic = resolveTopic(resource);
    return {
      resourceId: id,
      title: resource.title,
      topic,
      track: resolveTrack(topic, i),
      summary: resource.summary,
      promptHint: resource.promptHint,
      practiceProblemId: practiceProblemIdForResource(id),
    };
  });
}

export function ioaiYearPackTitles(
  year: IoaiPackYear,
  count: number = 5,
): string[] {
  return getIoaiYearPack(year, count).map((s) => s.title);
}
