import { count } from "drizzle-orm";
import { getDb } from "@/db";
import { ioaiResources } from "@/db/schema";
import ioaiData from "../../../content/resources/ioai-index.json";
import type {
  IoaiDomain,
  IoaiResource,
  IoaiResourceCategory,
} from "@/lib/content/resource-types";

type SeedDb = Awaited<ReturnType<typeof getDb>>;

const CATEGORIES = new Set<string>([
  "syllabus",
  "task_repo",
  "national_olympiad",
  "course",
]);

function parseSeedEntry(raw: unknown): IoaiResource | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? "").trim();
  const title = String(r.title ?? "").trim();
  const url = String(r.url ?? "").trim();
  const summary = String(r.summary ?? "").trim();
  const category = String(r.category ?? "").trim();
  if (!id || !title || !url || !summary || !CATEGORIES.has(category)) {
    return null;
  }
  const domains = Array.isArray(r.domains)
    ? r.domains.map(String).filter(Boolean)
    : [];
  const topics = Array.isArray(r.topics)
    ? r.topics.map(String).filter(Boolean)
    : [];
  const yearRaw = r.year == null ? undefined : Number(r.year);
  const year =
    typeof yearRaw === "number" && Number.isFinite(yearRaw)
      ? Math.trunc(yearRaw)
      : undefined;
  const region =
    typeof r.region === "string" && r.region.trim()
      ? r.region.trim()
      : undefined;
  const promptHint =
    typeof r.promptHint === "string" && r.promptHint.trim()
      ? r.promptHint.trim()
      : undefined;

  return {
    id,
    category: category as IoaiResourceCategory,
    title,
    url,
    summary,
    region,
    year,
    domains: domains as IoaiDomain[],
    topics,
    promptHint,
  };
}

/**
 * Seed ioai_resources from content/resources/ioai-index.json when the table
 * is empty. Idempotent — never wipes admin edits on restart.
 */
export async function seedIoaiResourcesIfEmpty(
  db?: SeedDb,
): Promise<number> {
  const database = db ?? (await getDb());
  const [{ value: existing }] = await database
    .select({ value: count() })
    .from(ioaiResources);
  if (Number(existing) > 0) return 0;

  const entries = (Array.isArray(ioaiData) ? ioaiData : [])
    .map(parseSeedEntry)
    .filter((e): e is IoaiResource => e != null);

  if (entries.length === 0) return 0;

  const now = new Date();
  await database.insert(ioaiResources).values(
    entries.map((e) => ({
      id: e.id,
      category: e.category,
      title: e.title,
      url: e.url,
      summary: e.summary,
      region: e.region ?? null,
      year: e.year ?? null,
      domains: e.domains,
      topics: e.topics,
      promptHint: e.promptHint ?? null,
      source: "curated",
      hidden: false,
      updatedAt: now,
    })),
  );

  return entries.length;
}
