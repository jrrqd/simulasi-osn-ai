/** Pure helpers for lesson markdown. Safe to import from server or client. */

export type LessonTocItem = { id: string; text: string; level: 2 | 3 };

/** Extract h2/h3 headings from markdown body for TOC. */
export function extractMarkdownToc(body: string): LessonTocItem[] {
  const items: LessonTocItem[] = [];
  for (const line of body.split("\n")) {
    const m = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    const level = m[1]!.length === 2 ? 2 : 3;
    const text = m[2]!.replace(/[#*`]/g, "").trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (text && id) items.push({ id, text, level });
  }
  return items;
}
