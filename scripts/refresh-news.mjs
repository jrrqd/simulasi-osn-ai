#!/usr/bin/env node
/**
 * News refresh for /berita (systemd timer checks hourly; schedule from DB).
 *
 * Reads keywords + interval from news_feed_settings (falls back to defaults).
 * Skip when not due unless FORCE=1 or --force.
 *
 * Usage: node scripts/refresh-news.mjs [--force]
 * Env: DATABASE_URL (required in production). Loads nothing from .env itself —
 * systemd EnvironmentFile=/etc/osnai/env supplies it on the VPS.
 */
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";

const DEFAULT_KEYWORDS = [
  "osn ai",
  "osn informatika",
  "ioai",
  "ekka",
  "toki",
  "tim olimpiade komputer indonesia",
];
const SUMMARY_MAX = 280;
const TRACKING = new Set([
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

const DDL = `
CREATE TABLE IF NOT EXISTS news_items (
  id text PRIMARY KEY,
  canonical_url text NOT NULL UNIQUE,
  title text NOT NULL,
  source_name text NOT NULL,
  source_host text NOT NULL,
  summary text NOT NULL,
  keyword text NOT NULL,
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_items_published_idx ON news_items(published_at);
CREATE INDEX IF NOT EXISTS news_items_host_title_idx ON news_items(source_host, title);
CREATE TABLE IF NOT EXISTS news_feed_settings (
  id text PRIMARY KEY DEFAULT 'default',
  keywords jsonb NOT NULL,
  interval_hours integer NOT NULL DEFAULT 24,
  anchor_hour_wib integer NOT NULL DEFAULT 6,
  anchor_weekday_wib integer NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  last_refresh_at timestamptz,
  last_refresh_ok boolean,
  last_refresh_message text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE news_feed_settings
  ADD COLUMN IF NOT EXISTS anchor_weekday_wib integer NOT NULL DEFAULT 1;
`;

function normalizeKeywords(raw) {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\n,]+/)
      : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const k = String(item ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!k || k.length > 120 || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function currentHourWib(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return hour === 24 ? 0 : hour;
}

function currentWeekdayWib(now = new Date()) {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
  }).format(now);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 1;
}

function isDue(
  { enabled, intervalHours, anchorHourWib, anchorWeekdayWib },
  now = new Date(),
) {
  if (!enabled) return false;
  const hour = currentHourWib(now);
  const interval = Math.max(1, Math.trunc(intervalHours) || 24);
  const anchor = ((Math.trunc(anchorHourWib) % 24) + 24) % 24;
  if (interval >= 168) {
    const weekday = Math.min(
      6,
      Math.max(0, Math.trunc(Number(anchorWeekdayWib) || 1)),
    );
    return currentWeekdayWib(now) === weekday && hour === anchor;
  }
  return (hour - anchor + 24) % interval === 0;
}

async function loadSettings(sql) {
  const rows = await sql`
    SELECT keywords, interval_hours, anchor_hour_wib, anchor_weekday_wib, enabled
    FROM news_feed_settings WHERE id = 'default' LIMIT 1
  `;
  if (!rows.length) {
    return {
      keywords: [...DEFAULT_KEYWORDS],
      intervalHours: 24,
      anchorHourWib: 6,
      anchorWeekdayWib: 1,
      enabled: true,
    };
  }
  const row = rows[0];
  const keywords = normalizeKeywords(row.keywords);
  const intervalRaw = Number(row.interval_hours);
  const intervalHours = [1, 6, 12, 24, 168].includes(intervalRaw)
    ? intervalRaw
    : 24;
  let anchor = Number(row.anchor_hour_wib);
  if (!Number.isFinite(anchor)) anchor = 6;
  anchor = Math.min(23, Math.max(0, Math.trunc(anchor)));
  let weekday = Number(row.anchor_weekday_wib);
  if (!Number.isFinite(weekday)) weekday = 1;
  weekday = Math.min(6, Math.max(0, Math.trunc(weekday)));
  return {
    keywords: keywords.length ? keywords : [...DEFAULT_KEYWORDS],
    intervalHours,
    anchorHourWib: anchor,
    anchorWeekdayWib: weekday,
    enabled: row.enabled !== false,
  };
}

async function recordResult(sql, ok, message) {
  const settings = await loadSettings(sql);
  await sql`
    INSERT INTO news_feed_settings (
      id, keywords, interval_hours, anchor_hour_wib, anchor_weekday_wib, enabled,
      last_refresh_at, last_refresh_ok, last_refresh_message, updated_at
    ) VALUES (
      'default',
      ${sql.json(settings.keywords)},
      ${settings.intervalHours},
      ${settings.anchorHourWib},
      ${settings.anchorWeekdayWib},
      ${settings.enabled},
      ${new Date()},
      ${ok},
      ${String(message).slice(0, 500)},
      ${new Date()}
    )
    ON CONFLICT (id) DO UPDATE SET
      last_refresh_at = EXCLUDED.last_refresh_at,
      last_refresh_ok = EXCLUDED.last_refresh_ok,
      last_refresh_message = EXCLUDED.last_refresh_message
  `;
}

function id() {
  return randomBytes(12).toString("hex");
}

function decodeEntities(input) {
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
function stripHtml(input) {
  let s = decodeEntities(input);
  for (let i = 0; i < 3; i++) {
    const next = s
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/<[^>]*$/g, " ");
    if (next === s) break;
    s = next;
  }
  return s.replace(/\s+/g, " ").trim();
}

function isJunkSummary(clean) {
  if (!clean) return true;
  if (/^https?:\/\//i.test(clean)) return true;
  if (/news\.google\.com\/rss\/articles/i.test(clean)) return true;
  if (/<\s*a\b/i.test(clean) || /\ba\s+href\s*=/i.test(clean)) return true;
  if (/href\s*=\s*["']/i.test(clean)) return true;
  if (clean.replace(/[\s."'=/\-_:?&%]/g, "").length < 12) return true;
  return false;
}

function truncateSummary(text, title, sourceName) {
  let clean = stripHtml(text);
  if (isJunkSummary(clean)) {
    clean = `${title} — cuplikan dari ${sourceName}. Baca selengkapnya di situs penerbit.`;
  }
  if (clean.length <= SUMMARY_MAX) return clean;
  const cut = clean.slice(0, SUMMARY_MAX - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function normalizeTitle(title) {
  return title.replace(/\s+/g, " ").trim().toLowerCase();
}

function canonicalizeUrl(raw) {
  try {
    const u = new URL(raw);
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING.has(key.toLowerCase())) u.searchParams.delete(key);
    }
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  return m[1]
    .replace(/^<!\[CDATA\[/i, "")
    .replace(/\]\]>$/i, "")
    .trim();
}

function parseRss(xml) {
  const items = [];
  for (const block of xml.match(/<item[\s\S]*?<\/item>/gi) ?? []) {
    const titleRaw = stripHtml(extractTag(block, "title"));
    const link = stripHtml(extractTag(block, "link"));
    const description = extractTag(block, "description");
    const sourceName =
      stripHtml(extractTag(block, "source")) ||
      titleRaw.split(" - ").slice(-1)[0]?.trim() ||
      "Berita";
    const pubRaw = extractTag(block, "pubDate");
    const pubDate = pubRaw ? new Date(pubRaw) : null;
    const href = description.match(/href=["']([^"']+)["']/i)?.[1];
    items.push({
      title: titleRaw.replace(/\s+-\s+[^-]+$/, "").trim() || titleRaw,
      link: href || link,
      sourceName,
      description,
      pubDate: pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate : null,
    });
  }
  return items;
}

async function fetchKeyword(keyword) {
  const q = encodeURIComponent(keyword);
  const url = `https://news.google.com/rss/search?q=${q}&hl=id&gl=ID&ceid=ID:id`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "SimulasiOSNAINewsBot/1.0 (+https://radr.nxtdev.xyz/simosnai)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`RSS ${keyword}: HTTP ${res.status}`);
  return parseRss(await res.text());
}

async function main() {
  const force =
    process.env.FORCE === "1" || process.argv.includes("--force");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.startsWith("pglite:")) {
    console.error("DATABASE_URL (Postgres) is required for refresh-news");
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 2 });
  try {
    await sql.unsafe(DDL);
    const settings = await loadSettings(sql);

    if (!force && !isDue(settings)) {
      console.log(
        JSON.stringify({
          ok: true,
          skippedSchedule: true,
          enabled: settings.enabled,
          intervalHours: settings.intervalHours,
          anchorHourWib: settings.anchorHourWib,
          anchorWeekdayWib: settings.anchorWeekdayWib,
          hourWib: currentHourWib(),
          weekdayWib: currentWeekdayWib(),
        }),
      );
      return;
    }

    if (!settings.enabled && !force) {
      console.log(JSON.stringify({ ok: true, skippedDisabled: true }));
      return;
    }

    // Re-sanitize summaries already stored with entity-encoded / truncated HTML.
    const existing = await sql`
      SELECT id, title, source_name, summary FROM news_items
    `;
    let cleaned = 0;
    for (const row of existing) {
      const next = truncateSummary(row.summary, row.title, row.source_name);
      if (next !== row.summary) {
        await sql`UPDATE news_items SET summary = ${next} WHERE id = ${row.id}`;
        cleaned += 1;
      }
    }
    if (cleaned) console.log(`[cleanup] re-sanitized ${cleaned} summaries`);

    let inserted = 0;
    let skipped = 0;
    const errors = [];
    const keywords = settings.keywords;

    for (const keyword of keywords) {
      let items = [];
      try {
        items = await fetchKeyword(keyword);
        console.log(`[${keyword}] fetched ${items.length}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(msg);
        console.error(`[${keyword}] ${msg}`);
        continue;
      }

      for (const item of items) {
        const canonicalUrl = canonicalizeUrl(item.link);
        if (!canonicalUrl) {
          skipped += 1;
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
          skipped += 1;
          continue;
        }

        const existingRow = await sql`
          SELECT id FROM news_items WHERE canonical_url = ${canonicalUrl} LIMIT 1
        `;
        if (existingRow.length) {
          skipped += 1;
          continue;
        }

        const sameTitle = await sql`
          SELECT title FROM news_items WHERE source_host = ${sourceHost} LIMIT 200
        `;
        if (
          sameTitle.some(
            (row) => normalizeTitle(row.title) === normalizeTitle(title),
          )
        ) {
          skipped += 1;
          continue;
        }

        try {
          await sql`
            INSERT INTO news_items (
              id, canonical_url, title, source_name, source_host,
              summary, keyword, published_at, fetched_at
            ) VALUES (
              ${id()}, ${canonicalUrl}, ${title}, ${item.sourceName.slice(0, 120)},
              ${sourceHost}, ${summary}, ${keyword},
              ${item.pubDate}, ${new Date()}
            )
          `;
          inserted += 1;
        } catch (err) {
          // Unique race / conflict → skip
          skipped += 1;
          if (!(err && String(err.message || err).includes("unique"))) {
            console.warn("insert warn:", err);
          }
        }
      }
    }

    const summaryMsg = `inserted=${inserted} skipped=${skipped} errors=${errors.length}`;
    await recordResult(sql, errors.length === 0, summaryMsg);

    console.log(
      JSON.stringify({
        ok: true,
        inserted,
        skipped,
        errors,
        keywords: keywords.length,
        force,
        fingerprint: createHash("sha1")
          .update(String(Date.now()))
          .digest("hex")
          .slice(0, 8),
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
