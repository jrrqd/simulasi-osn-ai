/**
 * Dev-time helper: refresh promptHint / summary for selected IOAI notebook
 * entries by fetching raw GitHub README / notebook markdown cells.
 *
 * Does NOT write the catalog by default — prints suggested updates as JSON.
 * Usage: npx tsx scripts/build-ioai-catalog.ts
 *
 * Optional: WRITE=1 npx tsx scripts/build-ioai-catalog.ts
 * to merge updates into content/resources/ioai-index.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type CatalogEntry = {
  id: string;
  title: string;
  url: string;
  summary: string;
  promptHint?: string;
  [key: string]: unknown;
};

/** Known raw sources for priority enrichment (plan §1). */
const ENRICH_SOURCES: Record<
  string,
  { kind: "readme" | "notebook"; rawUrl: string }
> = {
  "ioai-2025-repo": {
    kind: "readme",
    rawUrl:
      "https://raw.githubusercontent.com/IOAI-official/IOAI-2025/main/README.md",
  },
  "ioai-2025-radar": {
    kind: "notebook",
    rawUrl:
      "https://raw.githubusercontent.com/IOAI-official/IOAI-2025/main/Individual-Contest/Radar/Radar.ipynb",
  },
  "awesome-ioai-tasks": {
    kind: "readme",
    rawUrl:
      "https://raw.githubusercontent.com/open-cu/awesome-ioai-tasks/main/README.md",
  },
};

function clip(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

function extractNotebookProblemDescription(nbJson: string): string | null {
  try {
    const nb = JSON.parse(nbJson) as {
      cells?: Array<{ cell_type?: string; source?: string | string[] }>;
    };
    const md = (nb.cells ?? [])
      .filter((c) => c.cell_type === "markdown")
      .map((c) =>
        Array.isArray(c.source) ? c.source.join("") : String(c.source ?? ""),
      )
      .join("\n");
    // Prefer "## 1. Problem Description" … next "##"
    const m = md.match(
      /##\s*1\.\s*Problem Description\s*([\s\S]*?)(?=\n##\s*\d|\n##\s*[A-Z]|$)/i,
    );
    if (m?.[1]) return clip(m[1], 280);
    // Fallback: first substantial markdown block after title
    const paras = md
      .split(/\n{2,}/)
      .map((p) => p.replace(/[#*`\[\]]/g, "").trim())
      .filter((p) => p.length > 80);
    return paras[0] ? clip(paras[0], 280) : null;
  } catch {
    return null;
  }
}

function extractReadmeBlurb(md: string): string | null {
  const paras = md
    .split(/\n{2,}/)
    .map((p) => p.replace(/^#+\s+.*/gm, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim())
    .filter((p) => p.length > 60 && !p.startsWith("```"));
  return paras[0] ? clip(paras[0], 280) : null;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "osnai-ioai-catalog-builder/1.0" },
    });
    if (!res.ok) {
      console.warn(`Fetch failed ${res.status}: ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`Fetch error for ${url}:`, err);
    return null;
  }
}

async function main() {
  const catalogPath = resolve(
    process.cwd(),
    "content/resources/ioai-index.json",
  );
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as CatalogEntry[];
  const updates: Array<{ id: string; promptHint: string }> = [];

  for (const [id, source] of Object.entries(ENRICH_SOURCES)) {
    const entry = catalog.find((e) => e.id === id);
    if (!entry) {
      console.warn(`Catalog missing id=${id}`);
      continue;
    }
    console.log(`Fetching ${id}…`);
    const text = await fetchText(source.rawUrl);
    if (!text) continue;

    const hint =
      source.kind === "notebook"
        ? extractNotebookProblemDescription(text)
        : extractReadmeBlurb(text);

    if (!hint) {
      console.warn(`No blurb extracted for ${id}`);
      continue;
    }
    updates.push({ id, promptHint: hint });
    console.log(`  → ${hint.slice(0, 100)}…`);
  }

  console.log("\nSuggested updates:");
  console.log(JSON.stringify(updates, null, 2));

  if (process.env.WRITE === "1" && updates.length > 0) {
    const byId = new Map(updates.map((u) => [u.id, u.promptHint]));
    const next = catalog.map((e) =>
      byId.has(e.id) ? { ...e, promptHint: byId.get(e.id) } : e,
    );
    writeFileSync(catalogPath, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`\nWrote ${updates.length} promptHint updates to ${catalogPath}`);
  } else {
    console.log("\nDry run only. Set WRITE=1 to merge into ioai-index.json.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
