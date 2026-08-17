import ioaiData from "../../../content/resources/ioai-index.json";
import { getDb } from "@/db";
import { ioaiResources } from "@/db/schema";
import type { TrackId } from "@/lib/content/types";
import { TRACKS } from "@/lib/content/types";
import type {
  IoaiDomain,
  IoaiResource,
  IoaiResourceCategory,
  IoaiResourceRecord,
  IoaiResourceSource,
} from "@/lib/content/resource-types";
import { IOAI_CATEGORIES } from "@/lib/content/resource-types";
import type { Phase } from "@/lib/user/phase";

const MAX_PROMPT_ENTRIES = 4;
const MAX_SUMMARY_CHARS = 150;
const MAX_PROMPT_BLOCK_CHARS = 800;
const DEFAULT_UI_LIMIT = 6;

const CATEGORY_SET = new Set<string>(IOAI_CATEGORIES);

function isIoaiResource(raw: unknown): raw is IoaiResource {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    typeof r.title !== "string" ||
    typeof r.url !== "string" ||
    typeof r.summary !== "string" ||
    !Array.isArray(r.domains) ||
    !Array.isArray(r.topics) ||
    typeof r.category !== "string" ||
    !CATEGORY_SET.has(r.category)
  ) {
    return false;
  }
  return true;
}

function normalizeResource(raw: IoaiResource): IoaiResource {
  return {
    ...raw,
    category: raw.category as IoaiResourceCategory,
    domains: raw.domains as IoaiDomain[],
    topics: raw.topics.map(String),
    summary: String(raw.summary),
    promptHint:
      typeof raw.promptHint === "string" ? raw.promptHint : undefined,
  };
}

/** Static JSON fallback when DB is empty / unavailable. */
const JSON_FALLBACK: IoaiResource[] = (ioaiData as unknown as unknown[])
  .filter(isIoaiResource)
  .map(normalizeResource);

function rowToRecord(row: {
  id: string;
  category: string;
  title: string;
  url: string;
  summary: string;
  region: string | null;
  year: number | null;
  domains: string[];
  topics: string[];
  promptHint: string | null;
  source: string;
  hidden: boolean;
  updatedAt: Date;
}): IoaiResourceRecord | null {
  if (!CATEGORY_SET.has(row.category)) return null;
  return {
    id: row.id,
    category: row.category as IoaiResourceCategory,
    title: row.title,
    url: row.url,
    summary: row.summary,
    region: row.region ?? undefined,
    year: row.year ?? undefined,
    domains: (row.domains ?? []) as IoaiDomain[],
    topics: row.topics ?? [],
    promptHint: row.promptHint ?? undefined,
    source: row.source === "admin" ? "admin" : "curated",
    hidden: row.hidden,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublic(resource: IoaiResourceRecord): IoaiResource {
  return {
    id: resource.id,
    category: resource.category,
    title: resource.title,
    url: resource.url,
    region: resource.region,
    year: resource.year,
    domains: resource.domains,
    topics: resource.topics,
    summary: resource.summary,
    promptHint: resource.promptHint,
  };
}

/**
 * All admin-visible rows (including hidden). Seeds from JSON if table empty.
 */
export async function listIoaiResourceRecords(): Promise<IoaiResourceRecord[]> {
  try {
    const { seedIoaiResourcesIfEmpty } = await import(
      "@/lib/content/seed-ioai-resources"
    );
    await seedIoaiResourcesIfEmpty();

    const db = await getDb();
    const rows = await db.select().from(ioaiResources);
    if (rows.length === 0) {
      return JSON_FALLBACK.map((r) => ({
        ...r,
        source: "curated" as IoaiResourceSource,
        hidden: false,
      }));
    }
    return rows
      .map(rowToRecord)
      .filter((r): r is IoaiResourceRecord => r != null)
      .sort((a, b) => a.title.localeCompare(b.title, "id"));
  } catch (err) {
    console.warn("[ioai-resources] DB list failed, using JSON fallback:", err);
    return JSON_FALLBACK.map((r) => ({
      ...r,
      source: "curated" as const,
      hidden: false,
    }));
  }
}

/** Visible (non-hidden) resources for student UI + LLM. */
export async function getIoaiResources(): Promise<IoaiResource[]> {
  const all = await listIoaiResourceRecords();
  return all.filter((r) => !r.hidden).map(toPublic);
}

function clip(text: string, max: number) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

function scoreForTopic(resource: IoaiResource, topic: string | undefined) {
  if (!topic) return 0;
  if (resource.topics.includes(topic)) return 3;
  return 0;
}

function categoryPriority(category: IoaiResourceCategory) {
  switch (category) {
    case "national_olympiad":
      return 4;
    case "task_repo":
      return 3;
    case "syllabus":
      return 2;
    case "course":
      return 1;
    default:
      return 0;
  }
}

function sortResources(
  resources: IoaiResource[],
  topic?: string,
): IoaiResource[] {
  return [...resources].sort((a, b) => {
    const topicDiff = scoreForTopic(b, topic) - scoreForTopic(a, topic);
    if (topicDiff !== 0) return topicDiff;
    const catDiff = categoryPriority(b.category) - categoryPriority(a.category);
    if (catDiff !== 0) return catDiff;
    return (b.year ?? 0) - (a.year ?? 0);
  });
}

function filterForTopic(
  all: IoaiResource[],
  track: TrackId | undefined,
  topic: string | undefined,
  opts?: { limit?: number; includeCourses?: boolean },
): IoaiResource[] {
  const limit = opts?.limit ?? DEFAULT_UI_LIMIT;
  const includeCourses = opts?.includeCourses ?? true;
  const allowedTopics =
    track && TRACKS[track] ? new Set(TRACKS[track].topics) : null;

  let matched = all.filter((r) => {
    if (!includeCourses && r.category === "course") return false;
    if (!topic) return true;
    if (r.topics.length === 0) {
      return r.category === "syllabus" || r.category === "task_repo";
    }
    if (!r.topics.includes(topic)) return false;
    if (allowedTopics && !r.topics.some((t) => allowedTopics.has(t))) {
      return false;
    }
    return true;
  });

  if (topic) {
    const topicHits = matched.filter((r) => r.topics.includes(topic));
    if (topicHits.length > 0) {
      matched = topicHits;
    } else {
      matched = all.filter(
        (r) => r.category === "syllabus" || r.category === "task_repo",
      );
    }
  }

  return sortResources(matched, topic).slice(0, limit);
}

export async function getIoaiResourcesForTopic(
  track: TrackId | undefined,
  topic: string | undefined,
  opts?: { limit?: number; includeCourses?: boolean },
): Promise<IoaiResource[]> {
  const all = await getIoaiResources();
  return filterForTopic(all, track, topic, opts);
}

export async function getIoaiResourcesForPhase(
  phase: Phase,
  opts?: {
    track?: TrackId;
    topic?: string;
    limit?: number;
    includeCourses?: boolean;
  },
): Promise<IoaiResource[]> {
  // Available for all prep phases (pre-seleksi, semifinal, final).
  void phase;
  return getIoaiResourcesForTopic(opts?.track, opts?.topic, {
    limit: opts?.limit ?? DEFAULT_UI_LIMIT,
    includeCourses: opts?.includeCourses,
  });
}

export async function buildIoaiReferenceContext(params: {
  track?: TrackId;
  topic?: string;
  phase: Phase;
  /** @deprecated Always included for every phase; kept for call-site compat. */
  forceInclude?: boolean;
  limit?: number;
  /** Prefer syllabus + task_repo entries (Final IOAI mode). */
  prioritizeSyllabus?: boolean;
  /** Pin to specific catalog IDs (year-pack analog slots). */
  resourceIds?: string[];
}): Promise<string> {
  void params.forceInclude;

  const limit = params.limit ?? MAX_PROMPT_ENTRIES;
  let resources: IoaiResource[];

  if (params.resourceIds && params.resourceIds.length > 0) {
    const idSet = new Set(params.resourceIds);
    const fromDb = await getIoaiResources();
    const byId = new Map(fromDb.map((r) => [r.id, r]));
    // Merge JSON fallback so newly curated pack IDs resolve even on stale DB seeds.
    for (const r of JSON_FALLBACK) {
      if (!byId.has(r.id)) byId.set(r.id, r);
    }
    resources = params.resourceIds
      .map((id) => byId.get(id))
      .filter((r): r is IoaiResource => r != null && idSet.has(r.id))
      .slice(0, limit);
  } else {
    resources = await getIoaiResourcesForTopic(params.track, params.topic, {
      limit: params.prioritizeSyllabus ? Math.max(limit, 6) : limit,
      includeCourses: false,
    });

    if (params.prioritizeSyllabus && resources.length > 0) {
      resources = [...resources].sort((a, b) => {
        const boost = (r: IoaiResource) =>
          r.category === "syllabus" ? 10 : r.category === "task_repo" ? 5 : 0;
        return boost(b) - boost(a);
      });
    }
  }

  if (resources.length === 0) return "";

  const lines: string[] = [
    params.resourceIds && params.resourceIds.length > 0
      ? "## Referensi paper IOAI (analog — JANGAN salin soal atau dataset)"
      : params.prioritizeSyllabus
        ? "## Referensi silabus & kompetisi IOAI (inspirasi gaya — JANGAN salin soal atau dataset)"
        : "## Referensi kompetisi IOAI (inspirasi gaya — JANGAN salin soal atau dataset)",
  ];

  for (const r of resources) {
    const regionYear = [r.region, r.year].filter(Boolean).join(" ");
    const label = regionYear ? `${regionYear} · ${r.title}` : r.title;
    const hint = r.promptHint?.trim()
      ? clip(r.promptHint, MAX_SUMMARY_CHARS)
      : clip(r.summary, MAX_SUMMARY_CHARS);
    lines.push(`- ${label}: ${hint}`);
  }

  let block = lines.join("\n");
  if (block.length > MAX_PROMPT_BLOCK_CHARS) {
    block = `${block.slice(0, MAX_PROMPT_BLOCK_CHARS).trimEnd()}\n…`;
  }
  return block;
}

/** Sync helpers for tests that exercise filtering without DB. */
export function filterIoaiResourcesFromList(
  all: IoaiResource[],
  track: TrackId | undefined,
  topic: string | undefined,
  opts?: { limit?: number; includeCourses?: boolean },
): IoaiResource[] {
  return filterForTopic(all, track, topic, opts);
}

export function getJsonIoaiFallback(): IoaiResource[] {
  return JSON_FALLBACK;
}

export { MAX_PROMPT_ENTRIES, MAX_PROMPT_BLOCK_CHARS };
