import { getDb } from "@/db";
import { ioaiGuides } from "@/db/schema";
import curated from "../../../content/resources/guides/index.json";
import type { IoaiGuide } from "@/lib/content/resource-types";

type SeedDb = Awaited<ReturnType<typeof getDb>>;

export function parseIoaiGuide(raw: unknown): IoaiGuide | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  const resourceId = String(row.resourceId ?? "").trim();
  const title = String(row.title ?? "").trim();
  const originalUrl = String(row.originalUrl ?? "").trim();
  if (!id || !resourceId || !title || !originalUrl) return null;

  const topics = Array.isArray(row.topics)
    ? row.topics.map(String).filter(Boolean)
    : [];
  const solutionUrl =
    typeof row.solutionUrl === "string" && row.solutionUrl.trim()
      ? row.solutionUrl.trim()
      : undefined;

  return {
    id,
    resourceId,
    title,
    ringkasan: String(row.ringkasan ?? ""),
    kunciJawaban: String(row.kunciJawaban ?? ""),
    pembahasan: String(row.pembahasan ?? ""),
    originalUrl,
    solutionUrl,
    credit: String(row.credit ?? ""),
    topics,
  };
}

export function loadCuratedIoaiGuides(): IoaiGuide[] {
  if (!Array.isArray(curated)) return [];
  return curated
    .map(parseIoaiGuide)
    .filter((row): row is IoaiGuide => Boolean(row));
}

/**
 * Seed Indonesian IOAI study guides when the table is empty.
 * Requires ioai_resources rows to exist (seed resources first).
 */
export async function seedIoaiGuidesIfEmpty(db?: SeedDb): Promise<number> {
  const database = db ?? (await getDb());
  const existing = await database.query.ioaiGuides.findFirst({
    columns: { id: true },
  });
  if (existing) return 0;

  const rows = loadCuratedIoaiGuides();
  if (rows.length === 0) return 0;

  const now = new Date();
  await database.insert(ioaiGuides).values(
    rows.map((row) => ({
      id: row.id,
      resourceId: row.resourceId,
      title: row.title,
      ringkasan: row.ringkasan,
      kunciJawaban: row.kunciJawaban,
      pembahasan: row.pembahasan,
      originalUrl: row.originalUrl,
      solutionUrl: row.solutionUrl ?? null,
      credit: row.credit,
      topics: row.topics,
      hidden: false,
      updatedAt: now,
      createdAt: now,
    })),
  );
  return rows.length;
}
