import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { newsFeedSettings } from "@/db/schema";

/** Built-in defaults used when no admin row exists yet. */
export const DEFAULT_NEWS_KEYWORDS = [
  "osn ai",
  "osn informatika",
  "ioai",
  "ekka",
  "toki",
  "tim olimpiade komputer indonesia",
] as const;

export const NEWS_INTERVAL_HOURS_OPTIONS = [1, 6, 12, 24] as const;
export type NewsIntervalHours = (typeof NEWS_INTERVAL_HOURS_OPTIONS)[number];

export type NewsFeedSettingsView = {
  keywords: string[];
  intervalHours: NewsIntervalHours;
  anchorHourWib: number;
  enabled: boolean;
  lastRefreshAt: string | null;
  lastRefreshOk: boolean | null;
  lastRefreshMessage: string | null;
  updatedAt: string | null;
  configured: boolean;
};

export function normalizeKeywords(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\n,]+/)
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const k = String(item ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!k || k.length > 120) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function normalizeIntervalHours(raw: unknown): NewsIntervalHours {
  const n = Number(raw);
  if ((NEWS_INTERVAL_HOURS_OPTIONS as readonly number[]).includes(n)) {
    return n as NewsIntervalHours;
  }
  return 24;
}

export function normalizeAnchorHourWib(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 6;
  return Math.min(23, Math.max(0, Math.trunc(n)));
}

/** Current hour in Asia/Jakarta (0–23). */
export function currentHourWib(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  // en-GB can yield 24 for midnight in some engines — normalize.
  return hour === 24 ? 0 : hour;
}

/**
 * Whether a scheduled refresh should run this hour.
 * Schedule is every `intervalHours` starting at `anchorHourWib` (WIB).
 */
export function isNewsRefreshDue(opts: {
  enabled: boolean;
  intervalHours: number;
  anchorHourWib: number;
  now?: Date;
}): boolean {
  if (!opts.enabled) return false;
  const hour = currentHourWib(opts.now);
  const interval = Math.max(1, Math.trunc(opts.intervalHours) || 24);
  const anchor = ((Math.trunc(opts.anchorHourWib) % 24) + 24) % 24;
  return (hour - anchor + 24) % interval === 0;
}

export function describeNewsSchedule(
  intervalHours: number,
  anchorHourWib: number,
): string {
  const hh = String(anchorHourWib).padStart(2, "0");
  if (intervalHours === 1) {
    return `Setiap jam (mengacu ${hh}:00 WIB)`;
  }
  if (intervalHours === 24) {
    return `Setiap hari pukul ${hh}:00 WIB`;
  }
  const hours: string[] = [];
  for (let h = 0; h < 24; h += intervalHours) {
    const slot = (anchorHourWib + h) % 24;
    hours.push(`${String(slot).padStart(2, "0")}:00`);
  }
  return `Setiap ${intervalHours} jam (WIB: ${hours.join(", ")})`;
}

function defaultsView(): NewsFeedSettingsView {
  return {
    keywords: [...DEFAULT_NEWS_KEYWORDS],
    intervalHours: 24,
    anchorHourWib: 6,
    enabled: true,
    lastRefreshAt: null,
    lastRefreshOk: null,
    lastRefreshMessage: null,
    updatedAt: null,
    configured: false,
  };
}

export async function getNewsFeedSettings(): Promise<NewsFeedSettingsView> {
  const db = await getDb();
  const row = await db.query.newsFeedSettings.findFirst({
    where: eq(newsFeedSettings.id, "default"),
  });
  if (!row) return defaultsView();

  const keywords = normalizeKeywords(row.keywords);
  return {
    keywords: keywords.length ? keywords : [...DEFAULT_NEWS_KEYWORDS],
    intervalHours: normalizeIntervalHours(row.intervalHours),
    anchorHourWib: normalizeAnchorHourWib(row.anchorHourWib),
    enabled: row.enabled !== false,
    lastRefreshAt: row.lastRefreshAt?.toISOString() ?? null,
    lastRefreshOk: row.lastRefreshOk ?? null,
    lastRefreshMessage: row.lastRefreshMessage ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    configured: true,
  };
}

export async function saveNewsFeedSettings(input: {
  keywords: unknown;
  intervalHours: unknown;
  anchorHourWib: unknown;
  enabled: boolean;
  updatedBy?: string | null;
}): Promise<NewsFeedSettingsView> {
  const keywords = normalizeKeywords(input.keywords);
  if (keywords.length === 0) {
    throw new Error("Minimal satu kata kunci diperlukan");
  }
  if (keywords.length > 30) {
    throw new Error("Maksimal 30 kata kunci");
  }
  const intervalHours = normalizeIntervalHours(input.intervalHours);
  const anchorHourWib = normalizeAnchorHourWib(input.anchorHourWib);

  const db = await getDb();
  const existing = await db.query.newsFeedSettings.findFirst({
    where: eq(newsFeedSettings.id, "default"),
  });

  await db
    .insert(newsFeedSettings)
    .values({
      id: "default",
      keywords,
      intervalHours,
      anchorHourWib,
      enabled: input.enabled,
      lastRefreshAt: existing?.lastRefreshAt ?? null,
      lastRefreshOk: existing?.lastRefreshOk ?? null,
      lastRefreshMessage: existing?.lastRefreshMessage ?? null,
      updatedBy: input.updatedBy ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: newsFeedSettings.id,
      set: {
        keywords,
        intervalHours,
        anchorHourWib,
        enabled: input.enabled,
        updatedBy: input.updatedBy ?? null,
        updatedAt: new Date(),
      },
    });

  return getNewsFeedSettings();
}

export async function recordNewsRefreshResult(input: {
  ok: boolean;
  message: string;
}): Promise<void> {
  const db = await getDb();
  const existing = await db.query.newsFeedSettings.findFirst({
    where: eq(newsFeedSettings.id, "default"),
  });
  const keywords = existing
    ? normalizeKeywords(existing.keywords)
    : [...DEFAULT_NEWS_KEYWORDS];
  await db
    .insert(newsFeedSettings)
    .values({
      id: "default",
      keywords: keywords.length ? keywords : [...DEFAULT_NEWS_KEYWORDS],
      intervalHours: existing
        ? normalizeIntervalHours(existing.intervalHours)
        : 24,
      anchorHourWib: existing
        ? normalizeAnchorHourWib(existing.anchorHourWib)
        : 6,
      enabled: existing?.enabled ?? true,
      lastRefreshAt: new Date(),
      lastRefreshOk: input.ok,
      lastRefreshMessage: input.message.slice(0, 500),
      updatedBy: existing?.updatedBy ?? null,
      updatedAt: existing?.updatedAt ?? new Date(),
    })
    .onConflictDoUpdate({
      target: newsFeedSettings.id,
      set: {
        lastRefreshAt: new Date(),
        lastRefreshOk: input.ok,
        lastRefreshMessage: input.message.slice(0, 500),
      },
    });
}
