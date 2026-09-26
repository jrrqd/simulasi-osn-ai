import { desc, eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { newsItems } from "@/db/schema";
import {
  DEFAULT_NEWS_KEYWORDS,
  getNewsFeedSettings,
} from "@/lib/news/settings";

/** @deprecated Prefer getNewsFeedSettings().keywords — kept as compile-time default list. */
export const NEWS_KEYWORDS = DEFAULT_NEWS_KEYWORDS;

export type NewsKeyword = (typeof NEWS_KEYWORDS)[number] | string;

export type NewsItemRow = {
  id: string;
  canonicalUrl: string;
  title: string;
  sourceName: string;
  sourceHost: string;
  summary: string;
  keyword: string;
  publishedAt: Date | null;
  fetchedAt: Date;
};

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
]);

const SUMMARY_MAX = 280;
const LIST_LIMIT = 12;
/** Older items shown under “Berita sebelumnya” after falling out of the featured list. */
const PREVIOUS_LIMIT = 36;

function decodeEntities(input: string): string {
  return String(input || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/** Decode entities first, then strip tags (Google News often ships &lt;a href=…&gt;). */
export function stripHtml(input: string): string {
  let s = decodeEntities(input);
  // Repeat in case nested/broken markup remains after one pass.
  for (let i = 0; i < 3; i++) {
    const next = s
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      // Truncated mid-tag leftovers (e.g. summary cut at 280 chars inside href)
      .replace(/<[^>]*$/g, " ");
    if (next === s) break;
    s = next;
  }
  return s.replace(/\s+/g, " ").trim();
}

function isJunkSummary(clean: string): boolean {
  if (!clean) return true;
  if (/^https?:\/\//i.test(clean)) return true;
  if (/news\.google\.com\/rss\/articles/i.test(clean)) return true;
  if (/<\s*a\b/i.test(clean) || /\ba\s+href\s*=/i.test(clean)) return true;
  if (/href\s*=\s*["']/i.test(clean)) return true;
  // Mostly punctuation / leftover attribute noise
  if (clean.replace(/[\s."'=/\-_:?&%]/g, "").length < 12) return true;
  return false;
}

function truncateSummary(text: string, title: string, sourceName: string): string {
  let clean = stripHtml(text);
  // Google News descriptions are often only a link; don't show raw URLs/HTML.
  if (isJunkSummary(clean)) {
    clean = `${title} — cuplikan dari ${sourceName}. Baca selengkapnya di situs penerbit.`;
  }
  if (clean.length <= SUMMARY_MAX) return clean;
  const cut = clean.slice(0, SUMMARY_MAX - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Drop tracking params; prefer article URL extracted from Google News description. */
export function canonicalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
    }
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function googleNewsRssUrl(keyword: string): string {
  const q = encodeURIComponent(keyword);
  return `https://news.google.com/rss/search?q=${q}&hl=id&gl=ID&ceid=ID:id`;
}

type ParsedRssItem = {
  title: string;
  link: string;
  sourceName: string;
  description: string;
  pubDate: Date | null;
};

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  return m[1]
    .replace(/^<!\[CDATA\[/i, "")
    .replace(/\]\]>$/i, "")
    .trim();
}

function extractHrefFromDescription(description: string): string | null {
  const m = description.match(/href=["']([^"']+)["']/i);
  return m?.[1] ? m[1] : null;
}

function parseRssItems(xml: string): ParsedRssItem[] {
  const items: ParsedRssItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks) {
    const title = stripHtml(extractTag(block, "title"));
    const link = stripHtml(extractTag(block, "link"));
    const description = extractTag(block, "description");
    const sourceName =
      stripHtml(extractTag(block, "source")) ||
      title.split(" - ").slice(-1)[0]?.trim() ||
      "Berita";
    const pubRaw = extractTag(block, "pubDate");
    const pubDate = pubRaw ? new Date(pubRaw) : null;
    const fromDesc = extractHrefFromDescription(description);
    items.push({
      title: title.replace(/\s+-\s+[^-]+$/, "").trim() || title,
      link: fromDesc || link,
      sourceName,
      description,
      pubDate:
        pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate : null,
    });
  }
  return items;
}

async function fetchKeywordFeed(keyword: NewsKeyword): Promise<ParsedRssItem[]> {
  const url = googleNewsRssUrl(keyword);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "SimulasiOSNAINewsBot/1.0 (+https://radr.nxtdev.xyz/simosnai)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`RSS ${keyword}: HTTP ${res.status}`);
  }
  const xml = await res.text();
  return parseRssItems(xml);
}

export type RefreshNewsResult = {
  inserted: number;
  skipped: number;
  errors: string[];
  perKeyword: Record<string, { fetched: number; inserted: number }>;
};

export async function refreshNewsFromRss(
  keywordOverride?: string[],
): Promise<RefreshNewsResult> {
  const db = await getDb();
  const settings = await getNewsFeedSettings();
  const keywords =
    keywordOverride && keywordOverride.length > 0
      ? keywordOverride
      : settings.keywords;

  const result: RefreshNewsResult = {
    inserted: 0,
    skipped: 0,
    errors: [],
    perKeyword: {},
  };

  for (const keyword of keywords) {
    result.perKeyword[keyword] = { fetched: 0, inserted: 0 };
    let items: ParsedRssItem[] = [];
    try {
      items = await fetchKeywordFeed(keyword);
    } catch (err) {
      result.errors.push(
        err instanceof Error ? err.message : `RSS ${keyword} failed`,
      );
      continue;
    }
    result.perKeyword[keyword].fetched = items.length;

    for (const item of items) {
      const canonicalUrl = canonicalizeUrl(item.link);
      if (!canonicalUrl) {
        result.skipped += 1;
        continue;
      }
      const sourceHost = hostOf(canonicalUrl);
      const title = item.title.slice(0, 300);
      const summary = truncateSummary(
        item.description || "",
        title,
        item.sourceName,
      );
      if (!title || !summary) {
        result.skipped += 1;
        continue;
      }

      const existingUrl = await db
        .select({ id: newsItems.id })
        .from(newsItems)
        .where(eq(newsItems.canonicalUrl, canonicalUrl))
        .limit(1);
      if (existingUrl.length) {
        result.skipped += 1;
        continue;
      }

      const existingTitle = await db
        .select({ id: newsItems.id })
        .from(newsItems)
        .where(
          and(
            eq(newsItems.sourceHost, sourceHost),
            eq(newsItems.title, title),
          ),
        )
        .limit(1);
      if (existingTitle.length) {
        result.skipped += 1;
        continue;
      }

      // Also skip near-duplicate titles on same host (normalized).
      const sameHost = await db
        .select({ title: newsItems.title })
        .from(newsItems)
        .where(eq(newsItems.sourceHost, sourceHost))
        .limit(200);
      if (
        sameHost.some((row) => normalizeTitle(row.title) === normalizeTitle(title))
      ) {
        result.skipped += 1;
        continue;
      }

      await db.insert(newsItems).values({
        id: nanoid(),
        canonicalUrl,
        title,
        sourceName: item.sourceName.slice(0, 120),
        sourceHost,
        summary,
        keyword,
        publishedAt: item.pubDate,
        fetchedAt: new Date(),
      });
      result.inserted += 1;
      result.perKeyword[keyword].inserted += 1;
    }
  }

  return result;
}

function mapNewsRow(r: typeof newsItems.$inferSelect): NewsItemRow {
  return {
    id: r.id,
    canonicalUrl: r.canonicalUrl,
    title: r.title,
    sourceName: r.sourceName,
    sourceHost: r.sourceHost,
    summary: truncateSummary(r.summary, r.title, r.sourceName),
    keyword: r.keyword,
    publishedAt: r.publishedAt,
    fetchedAt: r.fetchedAt,
  };
}

export async function listLatestNews(
  limit = LIST_LIMIT,
): Promise<NewsItemRow[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(newsItems)
    .orderBy(desc(newsItems.publishedAt), desc(newsItems.fetchedAt))
    .limit(limit);
  return rows.map(mapNewsRow);
}

/**
 * Items that have rolled off the featured list (newest first after `offset`).
 * Used for the “Berita sebelumnya” archive on /berita.
 */
export async function listPreviousNews(options?: {
  /** How many featured items to skip (default = featured list size). */
  offset?: number;
  limit?: number;
}): Promise<NewsItemRow[]> {
  const offset = options?.offset ?? LIST_LIMIT;
  const limit = options?.limit ?? PREVIOUS_LIMIT;
  const db = await getDb();
  const rows = await db
    .select()
    .from(newsItems)
    .orderBy(desc(newsItems.publishedAt), desc(newsItems.fetchedAt))
    .offset(offset)
    .limit(limit);
  return rows.map(mapNewsRow);
}

export { LIST_LIMIT as NEWS_LIST_LIMIT, PREVIOUS_LIMIT as NEWS_PREVIOUS_LIMIT };
