import { getDb } from "@/db";
import { ioaiResources } from "@/db/schema";
import curated from "../../../content/resources/ioai-index.json";
import {
  IOAI_CATEGORIES,
  IOAI_DOMAINS,
  type IoaiDomain,
  type IoaiResource,
  type IoaiResourceCategory,
} from "@/lib/content/resource-types";

type SeedDb = Awaited<ReturnType<typeof getDb>>;

function isDomain(value: unknown): value is IoaiDomain {
  return typeof value === "string" && (IOAI_DOMAINS as string[]).includes(value);
}

function isCategory(value: unknown): value is IoaiResourceCategory {
  return (
    typeof value === "string" && (IOAI_CATEGORIES as string[]).includes(value)
  );
}

export function parseIoaiResource(raw: unknown): IoaiResource | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  const title = String(row.title ?? "").trim();
  const url = String(row.url ?? "").trim();
  const summary = String(row.summary ?? "").trim();
  if (!id || !title || !url || !isCategory(row.category)) return null;

  const domains = Array.isArray(row.domains)
    ? row.domains.filter(isDomain)
    : [];
  const topics = Array.isArray(row.topics)
    ? row.topics.map(String).filter(Boolean)
    : [];
  const yearRaw = row.year == null ? undefined : Number(row.year);
  const year =
    yearRaw != null && Number.isFinite(yearRaw) ? Math.trunc(yearRaw) : undefined;
  const region =
    typeof row.region === "string" && row.region.trim()
      ? row.region.trim()
      : undefined;
  const promptHint =
    typeof row.promptHint === "string" && row.promptHint.trim()
      ? row.promptHint.trim()
      : undefined;

  return {
    id,
    category: row.category,
    title,
    url,
    region,
    year,
    domains,
    topics,
    summary,
    promptHint,
  };
}

export function loadCuratedIoaiResources(): IoaiResource[] {
  if (!Array.isArray(curated)) return [];
  return curated
    .map(parseIoaiResource)
    .filter((row): row is IoaiResource => Boolean(row));
}

/**
 * Seed curated IOAI Education Hub resources when the table is empty.
 * Idempotent — permanent admin deletes stick until reseed is forced.
 */
export async function seedIoaiResourcesIfEmpty(
  db?: SeedDb,
): Promise<number> {
  const database = db ?? (await getDb());
  const existing = await database.query.ioaiResources.findFirst({
    columns: { id: true },
  });
  if (existing) return 0;

  const rows = loadCuratedIoaiResources();
  if (rows.length === 0) return 0;

  const now = new Date();
  await database.insert(ioaiResources).values(
    rows.map((row) => ({
      id: row.id,
      category: row.category,
      title: row.title,
      url: row.url,
      region: row.region ?? null,
      year: row.year ?? null,
      domains: row.domains,
      topics: row.topics,
      summary: row.summary,
      promptHint: row.promptHint ?? null,
      source: "curated" as const,
      hidden: false,
      updatedAt: now,
      createdAt: now,
    })),
  );
  return rows.length;
}
