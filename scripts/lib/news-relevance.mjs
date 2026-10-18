/**
 * Relevance gate for /berita RSS (shared: Next app + scripts/refresh-news.mjs).
 * Keep in sync when changing rules — tests live in src/lib/news/relevance.test.ts.
 */

/** Keywords that need an extra title/summary check (Google News over-matches). */
const STRICT_KEYWORDS = new Set(["ekka", "toki"]);

const AI_OR_EXHIBIT =
  /kecerdasan\s+artifisial|ekshibisi|eksebisi|artificial\s+intelligence/i;

const EKKA_CONTEXT =
  /\b(osn|olimpiade|kompetisi|medali|finalis|pemenang|talenta|siswa|umm|lks|dikmen|ai|kecerdasan|informatika|komputer)\b/i;

const TOKI_EXPLICIT =
  /toki\.id|tim\s+olimpiade\s+komputer|olimpiade\s+komputer\s+indonesia/i;

const TOKI_CONTEXT =
  /\b(olimpiade|komputer|informatika|ioai|noi|icpc|osn|medali|kompetisi|talenta|pelajar|siswa|pembinaan|seleksi|finalis|nasional|internasional|kemendik)\b/i;

const INDONESIA_CONTEXT =
  /\b(indonesia|jakarta|surabaya|bandung|kemendik|dikdasmen|menteri\s+pendidikan)\b/i;

/** Foreign press about unrelated “toki” (VN/JP/KR…) without Indonesian olympiad context. */
const FOREIGN_WITHOUT_INDONESIA =
  /\b(vietnam|việt\s*nam|hanoi|ha\s*nội|jepang|japan|tokyo|osaka|korea|korean|china|chinese|taiwan|thailand|filipina|philippines|malaysia|singapore|myanmar|cambodia)\b/i;

function isRelevantEkka(title, summary) {
  const t = title.trim();
  const blob = `${t} ${summary}`;

  if (AI_OR_EXHIBIT.test(blob)) return true;
  if (/\bekka\b/i.test(t) && EKKA_CONTEXT.test(blob)) return true;
  if (/\bosn\b/i.test(t)) return true;
  if (/\bioai\b/i.test(t)) return true;

  return false;
}

function isRelevantToki(title, summary) {
  const t = title.trim();
  const blob = `${t} ${summary}`;

  if (FOREIGN_WITHOUT_INDONESIA.test(blob) && !INDONESIA_CONTEXT.test(blob)) {
    return false;
  }

  if (TOKI_EXPLICIT.test(blob)) return true;
  if (/\btoki\b/i.test(blob) && TOKI_CONTEXT.test(blob)) return true;
  if (/\btoki\b/i.test(blob) && INDONESIA_CONTEXT.test(blob)) return true;
  if (/\bioai\b/i.test(t) && INDONESIA_CONTEXT.test(blob)) return true;
  if (/\bosn\s+informatika\b/i.test(blob)) return true;

  return false;
}

/**
 * @param {string} title
 * @param {string} summary
 * @param {string} keyword
 */
export function isRelevantOlympiadNews(title, summary, keyword) {
  const k = String(keyword ?? "").trim().toLowerCase();
  const t = String(title ?? "").trim();
  if (!t) return false;

  if (!STRICT_KEYWORDS.has(k)) return true;

  if (k === "ekka") return isRelevantEkka(t, summary);
  if (k === "toki") return isRelevantToki(t, summary);

  return true;
}

/**
 * Narrow Google News RSS query for ambiguous single-word keywords.
 * @param {string} keyword
 */
export function rssSearchQuery(keyword) {
  const k = String(keyword ?? "").trim().toLowerCase();
  if (k === "toki") {
    return '("tim olimpiade komputer indonesia" OR toki.id OR "TOKI" olimpiade komputer)';
  }
  return String(keyword ?? "").trim();
}
