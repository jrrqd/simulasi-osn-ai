import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ioaiGuides, ioaiResources } from "@/db/schema";
import {
  IOAI_CATEGORIES,
  IOAI_DOMAINS,
  type IoaiDomain,
  type IoaiResourceCategory,
  type IoaiResourceRecord,
  type IoaiResourceSource,
} from "@/lib/content/resource-types";
import { loadCuratedIoaiResources } from "@/lib/content/seed-ioai-resources";

function asDomains(value: unknown): IoaiDomain[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (d): d is IoaiDomain =>
      typeof d === "string" && (IOAI_DOMAINS as string[]).includes(d),
  );
}

function asCategory(value: unknown): IoaiResourceCategory {
  if (typeof value === "string" && (IOAI_CATEGORIES as string[]).includes(value)) {
    return value as IoaiResourceCategory;
  }
  return "task_repo";
}

function asSource(value: unknown): IoaiResourceSource {
  return value === "admin" ? "admin" : "curated";
}

function asTopics(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

type ResourceRow = typeof ioaiResources.$inferSelect;

function toRecord(
  row: ResourceRow,
  guideId?: string | null,
): IoaiResourceRecord {
  return {
    id: row.id,
    category: asCategory(row.category),
    title: row.title,
    url: row.url,
    region: row.region ?? undefined,
    year: row.year ?? undefined,
    domains: asDomains(row.domains),
    topics: asTopics(row.topics),
    summary: row.summary ?? "",
    promptHint: row.promptHint ?? undefined,
    source: asSource(row.source),
    hidden: Boolean(row.hidden),
    updatedAt: row.updatedAt?.toISOString?.() ?? undefined,
    guideId: guideId || undefined,
  };
}

async function guideIdByResourceId(
  resourceIds: string[],
): Promise<Map<string, string>> {
  if (resourceIds.length === 0) return new Map();
  const db = await getDb();
  const guides = await db.query.ioaiGuides.findMany({
    where: and(eq(ioaiGuides.hidden, false)),
    columns: { id: true, resourceId: true },
  });
  const map = new Map<string, string>();
  const wanted = new Set(resourceIds);
  for (const g of guides) {
    if (wanted.has(g.resourceId)) map.set(g.resourceId, g.id);
  }
  return map;
}

async function fallbackFromDisk(): Promise<IoaiResourceRecord[]> {
  return loadCuratedIoaiResources().map((row) => ({
    ...row,
    source: "curated" as const,
    hidden: false,
  }));
}

export async function listVisibleIoaiResources(): Promise<IoaiResourceRecord[]> {
  const db = await getDb();
  const rows = await db.query.ioaiResources.findMany({
    where: eq(ioaiResources.hidden, false),
    orderBy: [asc(ioaiResources.year), asc(ioaiResources.title)],
  });
  if (rows.length === 0) {
    return fallbackFromDisk();
  }
  const guideMap = await guideIdByResourceId(rows.map((r) => r.id));
  return rows.map((row) => toRecord(row, guideMap.get(row.id)));
}

export async function listAdminIoaiResources(): Promise<IoaiResourceRecord[]> {
  const db = await getDb();
  const rows = await db.query.ioaiResources.findMany({
    orderBy: [asc(ioaiResources.category), asc(ioaiResources.title)],
  });
  const guideMap = await guideIdByResourceId(rows.map((r) => r.id));
  // Include hidden guides for admin badge context
  const allGuides = await db.query.ioaiGuides.findMany({
    columns: { id: true, resourceId: true },
  });
  for (const g of allGuides) {
    if (!guideMap.has(g.resourceId)) guideMap.set(g.resourceId, g.id);
  }
  return rows.map((row) => toRecord(row, guideMap.get(row.id)));
}

export async function getIoaiResource(
  id: string,
): Promise<IoaiResourceRecord | null> {
  const db = await getDb();
  const row = await db.query.ioaiResources.findFirst({
    where: eq(ioaiResources.id, id),
  });
  if (!row || row.hidden) {
    const curated = loadCuratedIoaiResources().find((r) => r.id === id);
    if (!curated) return null;
    const guide = await db.query.ioaiGuides.findFirst({
      where: and(eq(ioaiGuides.resourceId, id), eq(ioaiGuides.hidden, false)),
      columns: { id: true },
    });
    return {
      ...curated,
      source: "curated",
      hidden: false,
      guideId: guide?.id,
    };
  }
  const guide = await db.query.ioaiGuides.findFirst({
    where: and(eq(ioaiGuides.resourceId, id), eq(ioaiGuides.hidden, false)),
    columns: { id: true },
  });
  return toRecord(row, guide?.id);
}

export async function listIoaiResourcesForPrompt(params?: {
  topics?: string[];
  limit?: number;
}): Promise<IoaiResourceRecord[]> {
  const all = await listVisibleIoaiResources();
  const topics = params?.topics?.filter(Boolean) ?? [];
  const limit = Math.max(1, Math.min(params?.limit ?? 8, 20));
  if (topics.length === 0) return all.slice(0, limit);

  const topicSet = new Set(topics);
  const scored = all
    .map((row) => {
      const hits = row.topics.filter((t) => topicSet.has(t)).length;
      return { row, hits };
    })
    .filter((x) => x.hits > 0 || x.row.promptHint)
    .sort((a, b) => b.hits - a.hits || (b.row.year ?? 0) - (a.row.year ?? 0));

  return scored.slice(0, limit).map((x) => x.row);
}

export async function upsertAdminIoaiResource(
  input: {
    id: string;
    category: IoaiResourceCategory;
    title: string;
    url: string;
    region?: string | null;
    year?: number | null;
    domains: IoaiDomain[];
    topics: string[];
    summary: string;
    promptHint?: string | null;
    hidden?: boolean;
  },
  updatedBy: string,
): Promise<IoaiResourceRecord> {
  const db = await getDb();
  const now = new Date();
  const existing = await db.query.ioaiResources.findFirst({
    where: eq(ioaiResources.id, input.id),
  });

  const values = {
    id: input.id,
    category: input.category,
    title: input.title,
    url: input.url,
    region: input.region ?? null,
    year: input.year ?? null,
    domains: input.domains,
    topics: input.topics,
    summary: input.summary,
    promptHint: input.promptHint ?? null,
    hidden: Boolean(input.hidden),
    updatedBy,
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(ioaiResources)
      .set(values)
      .where(eq(ioaiResources.id, input.id));
  } else {
    await db.insert(ioaiResources).values({
      ...values,
      source: "admin",
      createdAt: now,
    });
  }

  const row = await db.query.ioaiResources.findFirst({
    where: eq(ioaiResources.id, input.id),
  });
  if (!row) throw new Error("Failed to upsert ioai resource");
  const guide = await db.query.ioaiGuides.findFirst({
    where: eq(ioaiGuides.resourceId, input.id),
    columns: { id: true },
  });
  return toRecord(row, guide?.id);
}

export async function setIoaiResourceHidden(
  id: string,
  hidden: boolean,
  updatedBy: string,
): Promise<boolean> {
  const db = await getDb();
  const existing = await db.query.ioaiResources.findFirst({
    where: eq(ioaiResources.id, id),
    columns: { id: true },
  });
  if (!existing) return false;
  await db
    .update(ioaiResources)
    .set({ hidden, updatedBy, updatedAt: new Date() })
    .where(eq(ioaiResources.id, id));
  return true;
}
