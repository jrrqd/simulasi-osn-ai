import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ioaiGuides } from "@/db/schema";
import type { IoaiGuide, IoaiGuideRecord } from "@/lib/content/resource-types";
import { loadCuratedIoaiGuides } from "@/lib/content/seed-ioai-guides";

type GuideRow = typeof ioaiGuides.$inferSelect;

function toRecord(row: GuideRow): IoaiGuideRecord {
  return {
    id: row.id,
    resourceId: row.resourceId,
    title: row.title,
    ringkasan: row.ringkasan ?? "",
    kunciJawaban: row.kunciJawaban ?? "",
    pembahasan: row.pembahasan ?? "",
    originalUrl: row.originalUrl,
    solutionUrl: row.solutionUrl ?? undefined,
    credit: row.credit ?? "",
    topics: Array.isArray(row.topics) ? row.topics.map(String) : [],
    hidden: Boolean(row.hidden),
    updatedAt: row.updatedAt?.toISOString?.() ?? undefined,
  };
}

function fallbackGuide(id: string): IoaiGuideRecord | null {
  const curated = loadCuratedIoaiGuides().find((g) => g.id === id);
  if (!curated) return null;
  return { ...curated, hidden: false };
}

export async function getIoaiGuide(
  id: string,
  opts?: { includeHidden?: boolean },
): Promise<IoaiGuideRecord | null> {
  const db = await getDb();
  const row = await db.query.ioaiGuides.findFirst({
    where: eq(ioaiGuides.id, id),
  });
  if (!row) return fallbackGuide(id);
  if (row.hidden && !opts?.includeHidden) return null;
  return toRecord(row);
}

export async function getIoaiGuideByResourceId(
  resourceId: string,
): Promise<IoaiGuideRecord | null> {
  const db = await getDb();
  const row = await db.query.ioaiGuides.findFirst({
    where: and(
      eq(ioaiGuides.resourceId, resourceId),
      eq(ioaiGuides.hidden, false),
    ),
  });
  if (row) return toRecord(row);
  const curated = loadCuratedIoaiGuides().find(
    (g) => g.resourceId === resourceId,
  );
  return curated ? { ...curated, hidden: false } : null;
}

export async function listAdminIoaiGuides(): Promise<IoaiGuideRecord[]> {
  const db = await getDb();
  const rows = await db.query.ioaiGuides.findMany({
    orderBy: [asc(ioaiGuides.title)],
  });
  if (rows.length === 0) {
    return loadCuratedIoaiGuides().map((g) => ({ ...g, hidden: false }));
  }
  return rows.map(toRecord);
}

export async function updateIoaiGuide(
  id: string,
  patch: Partial<
    Pick<
      IoaiGuide,
      | "title"
      | "ringkasan"
      | "kunciJawaban"
      | "pembahasan"
      | "originalUrl"
      | "solutionUrl"
      | "credit"
      | "topics"
    >
  > & { hidden?: boolean },
  updatedBy: string,
): Promise<IoaiGuideRecord | null> {
  const db = await getDb();
  const existing = await db.query.ioaiGuides.findFirst({
    where: eq(ioaiGuides.id, id),
  });
  if (!existing) return null;

  const next = {
    title: patch.title ?? existing.title,
    ringkasan: patch.ringkasan ?? existing.ringkasan,
    kunciJawaban: patch.kunciJawaban ?? existing.kunciJawaban,
    pembahasan: patch.pembahasan ?? existing.pembahasan,
    originalUrl: patch.originalUrl ?? existing.originalUrl,
    solutionUrl:
      patch.solutionUrl === undefined
        ? existing.solutionUrl
        : patch.solutionUrl || null,
    credit: patch.credit ?? existing.credit,
    topics: patch.topics ?? existing.topics,
    hidden: patch.hidden ?? existing.hidden,
    updatedBy,
    updatedAt: new Date(),
  };

  await db.update(ioaiGuides).set(next).where(eq(ioaiGuides.id, id));
  const row = await db.query.ioaiGuides.findFirst({
    where: eq(ioaiGuides.id, id),
  });
  return row ? toRecord(row) : null;
}
