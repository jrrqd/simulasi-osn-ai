#!/usr/bin/env node
/**
 * Daily news refresh for /berita (06:00 Asia/Jakarta via systemd timer).
 *
 * Fetches Google News RSS for: osn ai, osn informatika, ioai, ekka.
 * Stores title + short snippet + canonical URL only (no full article body).
 * Skips duplicate canonical URLs and same-host duplicate titles.
 *
 * Usage: node scripts/refresh-news.mjs
 * Env: DATABASE_URL (required in production). Loads nothing from .env itself —
 * systemd EnvironmentFile=/etc/osnai/env supplies it on the VPS.
 */
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";

const KEYWORDS = ["osn ai", "osn informatika", "ioai", "ekka"];
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
`;

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
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.startsWith("pglite:")) {
    console.error("DATABASE_URL (Postgres) is required for refresh-news");
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 2 });
  try {
    await sql.unsafe(DDL);

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

    for (const keyword of KEYWORDS) {
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

        const existing = await sql`
          SELECT id FROM news_items WHERE canonical_url = ${canonicalUrl} LIMIT 1
        `;
        if (existing.length) {
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

    console.log(
      JSON.stringify({
        ok: true,
        inserted,
        skipped,
        errors,
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
