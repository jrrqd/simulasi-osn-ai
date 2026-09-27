/**
 * Relevance gate for /berita RSS inserts.
 * Short ambiguous keywords (especially "ekka") often match unrelated Indonesian news.
 */

/** Keywords that need an extra title check (Google News over-matches). */
const STRICT_KEYWORDS = new Set(["ekka"]);

const AI_OR_EXHIBIT =
  /kecerdasan\s+artifisial|ekshibisi|eksebisi|artificial\s+intelligence/i;

const EKKA_CONTEXT =
  /\b(osn|olimpiade|kompetisi|medali|finalis|pemenang|talenta|siswa|umm|lks|dikmen|ai|kecerdasan|informatika|komputer)\b/i;

/**
 * Returns false when the article is clearly off-topic for our olympiad news hub.
 * Conservative for non-strict keywords (trust the RSS query).
 */
export function isRelevantOlympiadNews(
  title: string,
  summary: string,
  keyword: string,
): boolean {
  const k = keyword.trim().toLowerCase();
  const t = title.trim();
  if (!t) return false;

  if (!STRICT_KEYWORDS.has(k)) return true;

  const blob = `${t} ${summary}`;

  // Explicit AI / exhibition framing
  if (AI_OR_EXHIBIT.test(blob)) return true;

  // Bare "EKKA" only if olympiad / education competition context is also present
  // (avoids film titles / crime blurbs that happen to contain "Ekka")
  if (/\bekka\b/i.test(t) && EKKA_CONTEXT.test(blob)) return true;

  // OSN national coverage often co-tagged under ekka keyword — keep those
  if (/\bosn\b/i.test(t)) return true;

  if (/\bioai\b/i.test(t)) return true;

  return false;
}
