import {
  diagramSpecSchema,
  figureInputSchema,
  type DiagramSpec,
  type FigureInput,
  type ProblemFigure,
} from "@/lib/ai/diagrams/types";

const FIG_PLACEHOLDER = /\{\{\s*fig:([a-zA-Z0-9_-]+)\s*\}\}/g;

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapSvg(
  width: number,
  height: number,
  body: string,
  title?: string,
) {
  const titleEl = title
    ? `<text x="${width / 2}" y="18" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="#1c2430">${escapeXml(title)}</text>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <rect width="100%" height="100%" fill="#fffef9"/>
  ${titleEl}
  ${body}
</svg>`;
}

const GROUP_COLORS = [
  "#0f6e56",
  "#b42318",
  "#a15c07",
  "#1d4ed8",
  "#7c3aed",
  "#0e7490",
];

function groupColor(group: string | undefined, index: number) {
  if (!group) return GROUP_COLORS[index % GROUP_COLORS.length]!;
  let hash = 0;
  for (let i = 0; i < group.length; i++) {
    hash = (hash * 31 + group.charCodeAt(i)) | 0;
  }
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length]!;
}

function renderScatter(spec: Extract<DiagramSpec, { kind: "scatter" }>) {
  const padL = 48;
  const padR = 24;
  const padT = spec.title ? 36 : 20;
  const padB = 44;
  const width = 420;
  const height = 320;
  const xs = spec.points.map((p) => p.x);
  const ys = spec.points.map((p) => p.y);
  for (const line of spec.lines ?? []) {
    xs.push(line.x1, line.x2);
    ys.push(line.y1, line.y2);
  }
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const sx = (x: number) => padL + ((x - minX) / (maxX - minX)) * plotW;
  const sy = (y: number) => padT + plotH - ((y - minY) / (maxY - minY)) * plotH;

  const axis = `
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#1c2430" stroke-width="1.5"/>
    <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#1c2430" stroke-width="1.5"/>
    <text x="${padL + plotW / 2}" y="${height - 10}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#5b6573">${escapeXml(spec.xLabel ?? "x")}</text>
    <text x="14" y="${padT + plotH / 2}" text-anchor="middle" transform="rotate(-90 14 ${padT + plotH / 2})" font-family="system-ui,sans-serif" font-size="11" fill="#5b6573">${escapeXml(spec.yLabel ?? "y")}</text>
  `;

  const lines = (spec.lines ?? [])
    .map(
      (line) =>
        `<line x1="${sx(line.x1)}" y1="${sy(line.y1)}" x2="${sx(line.x2)}" y2="${sy(line.y2)}" stroke="#a15c07" stroke-width="1.5" stroke-dasharray="4 3"/>${
          line.label
            ? `<text x="${(sx(line.x1) + sx(line.x2)) / 2}" y="${(sy(line.y1) + sy(line.y2)) / 2 - 6}" text-anchor="middle" font-size="10" fill="#a15c07" font-family="system-ui,sans-serif">${escapeXml(line.label)}</text>`
            : ""
        }`,
    )
    .join("");

  const points = spec.points
    .map((p, i) => {
      const cx = sx(p.x);
      const cy = sy(p.y);
      const color = groupColor(p.group, i);
      const label = p.label
        ? `<text x="${cx + 6}" y="${cy - 6}" font-size="10" fill="#1c2430" font-family="system-ui,sans-serif">${escapeXml(p.label)}</text>`
        : "";
      return `<circle cx="${cx}" cy="${cy}" r="5" fill="${color}" stroke="#fff" stroke-width="1"/>${label}`;
    })
    .join("");

  return wrapSvg(width, height, `${axis}${lines}${points}`, spec.title);
}

function renderGrid(spec: Extract<DiagramSpec, { kind: "grid" }>) {
  const rows = spec.cells.length;
  const cols = Math.max(...spec.cells.map((r) => r.length), 1);
  const cell = Math.min(28, Math.floor(360 / Math.max(cols, rows)));
  const padT = spec.title ? 36 : 16;
  const pad = 16;
  const width = pad * 2 + cols * cell;
  const height = padT + pad + rows * cell;

  const flat = spec.cells.flat();
  const minV = Math.min(...flat, 0);
  const maxV = Math.max(...flat, 1);

  const cells = spec.cells
    .map((row, r) =>
      row
        .map((v, c) => {
          const x = pad + c * cell;
          const y = padT + r * cell;
          let fill: string;
          if (spec.palette === "bw") {
            const t = v >= 0.5 ? 1 : 0;
            fill = t ? "#1c2430" : "#f4f1ea";
          } else {
            const t =
              maxV === minV ? 0.5 : (Number(v) - minV) / (maxV - minV);
            const g = Math.round(255 - t * 180);
            fill = `rgb(${g},${Math.round(220 - t * 80)},${Math.round(200 - t * 40)})`;
          }
          const text =
            spec.showValues && cell >= 22
              ? `<text x="${x + cell / 2}" y="${y + cell / 2 + 4}" text-anchor="middle" font-size="10" font-family="system-ui,sans-serif" fill="${spec.palette === "bw" && v >= 0.5 ? "#fff" : "#1c2430"}">${escapeXml(String(v))}</text>`
              : "";
          return `<rect x="${x}" y="${y}" width="${cell - 1}" height="${cell - 1}" fill="${fill}" stroke="#c9c2b6"/>${text}`;
        })
        .join(""),
    )
    .join("");

  return wrapSvg(width, height, cells, spec.title);
}

function layoutTreeLevels(
  nodes: { id: string; label: string; leaf?: boolean }[],
  edges: { from: string; to: string; label?: string }[],
) {
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of edges) {
    const list = children.get(e.from) ?? [];
    list.push(e.to);
    children.set(e.from, list);
    hasParent.add(e.to);
  }
  const roots = nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id);
  const root = roots[0] ?? nodes[0]?.id;
  const level = new Map<string, number>();
  const queue = root ? [root] : [];
  if (root) level.set(root, 0);
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of children.get(id) ?? []) {
      if (!level.has(child)) {
        level.set(child, (level.get(id) ?? 0) + 1);
        queue.push(child);
      }
    }
  }
  for (const n of nodes) {
    if (!level.has(n.id)) level.set(n.id, 0);
  }
  const byLevel = new Map<number, string[]>();
  for (const [id, lv] of level) {
    const list = byLevel.get(lv) ?? [];
    list.push(id);
    byLevel.set(lv, list);
  }
  return { level, byLevel, children };
}

function renderTree(spec: Extract<DiagramSpec, { kind: "tree" }>) {
  const { level, byLevel } = layoutTreeLevels(spec.nodes, spec.edges);
  const maxLevel = Math.max(0, ...level.values());
  const maxWidth = Math.max(
    1,
    ...[...byLevel.values()].map((ids) => ids.length),
  );
  const nodeW = 110;
  const nodeH = 36;
  const gapX = 24;
  const gapY = 56;
  const padT = spec.title ? 40 : 24;
  const width = Math.max(360, maxWidth * (nodeW + gapX) + 40);
  const height = padT + (maxLevel + 1) * (nodeH + gapY);

  const pos = new Map<string, { x: number; y: number }>();
  for (const [lv, ids] of byLevel) {
    const rowW = ids.length * (nodeW + gapX) - gapX;
    const startX = (width - rowW) / 2;
    ids.forEach((id, i) => {
      pos.set(id, {
        x: startX + i * (nodeW + gapX) + nodeW / 2,
        y: padT + lv * (nodeH + gapY),
      });
    });
  }

  const nodeById = new Map(spec.nodes.map((n) => [n.id, n]));
  const edges = spec.edges
    .map((e) => {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) return "";
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + nodeH / 2 + b.y - nodeH / 2) / 2;
      const label = e.label
        ? `<text x="${midX}" y="${midY}" text-anchor="middle" font-size="10" fill="#5b6573" font-family="system-ui,sans-serif">${escapeXml(e.label)}</text>`
        : "";
      return `<line x1="${a.x}" y1="${a.y + nodeH / 2}" x2="${b.x}" y2="${b.y - nodeH / 2}" stroke="#8a939e" stroke-width="1.5"/>${label}`;
    })
    .join("");

  const nodes = spec.nodes
    .map((n) => {
      const p = pos.get(n.id);
      if (!p) return "";
      const fill = n.leaf ? "#e8f5ef" : "#fff";
      const stroke = n.leaf ? "#0f6e56" : "#1c2430";
      return `<rect x="${p.x - nodeW / 2}" y="${p.y - nodeH / 2}" width="${nodeW}" height="${nodeH}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="11" font-family="system-ui,sans-serif" fill="#1c2430">${escapeXml(n.label.slice(0, 18))}</text>`;
    })
    .join("");

  void nodeById;
  return wrapSvg(width, height, `${edges}${nodes}`, spec.title);
}

function renderKernel(spec: Extract<DiagramSpec, { kind: "kernel" }>) {
  const rows = spec.matrix.length;
  const cols = Math.max(...spec.matrix.map((r) => r.length), 1);
  const cell = 44;
  const padT = spec.title ? 36 : 16;
  const pad = 16;
  const width = pad * 2 + cols * cell;
  const height = padT + pad + rows * cell;

  const cells = spec.matrix
    .map((row, r) =>
      row
        .map((v, c) => {
          const x = pad + c * cell;
          const y = padT + r * cell;
          return `<rect x="${x}" y="${y}" width="${cell - 2}" height="${cell - 2}" fill="#f4f1ea" stroke="#1c2430" stroke-width="1"/>
            <text x="${x + cell / 2 - 1}" y="${y + cell / 2 + 4}" text-anchor="middle" font-size="13" font-family="ui-monospace,monospace" fill="#1c2430">${escapeXml(String(v))}</text>`;
        })
        .join(""),
    )
    .join("");

  return wrapSvg(width, height, cells, spec.title);
}

function renderBars(spec: Extract<DiagramSpec, { kind: "bars" }>) {
  const padL = 48;
  const padR = 20;
  const padT = spec.title ? 36 : 20;
  const padB = 48;
  const width = 400;
  const height = 280;
  const maxV = Math.max(...spec.bars.map((b) => b.value), 1);
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const barGap = 8;
  const barW = Math.max(
    12,
    (plotW - barGap * (spec.bars.length + 1)) / spec.bars.length,
  );

  const axis = `
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#1c2430" stroke-width="1.5"/>
    <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#1c2430" stroke-width="1.5"/>
    ${
      spec.yLabel
        ? `<text x="14" y="${padT + plotH / 2}" text-anchor="middle" transform="rotate(-90 14 ${padT + plotH / 2})" font-size="11" fill="#5b6573" font-family="system-ui,sans-serif">${escapeXml(spec.yLabel)}</text>`
        : ""
    }
  `;

  const bars = spec.bars
    .map((b, i) => {
      const h = (b.value / maxV) * plotH;
      const x = padL + barGap + i * (barW + barGap);
      const y = padT + plotH - h;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#0f6e56" rx="3"/>
        <text x="${x + barW / 2}" y="${padT + plotH + 16}" text-anchor="middle" font-size="10" fill="#1c2430" font-family="system-ui,sans-serif">${escapeXml(b.label.slice(0, 10))}</text>
        <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="10" fill="#5b6573" font-family="system-ui,sans-serif">${escapeXml(String(b.value))}</text>`;
    })
    .join("");

  return wrapSvg(width, height, `${axis}${bars}`, spec.title);
}

function renderTable(spec: Extract<DiagramSpec, { kind: "table" }>) {
  const cols = spec.headers.length;
  const rows = spec.rows.length;
  const colW = Math.max(72, Math.min(120, Math.floor(480 / cols)));
  const rowH = 28;
  const padT = spec.title ? 36 : 16;
  const pad = 12;
  const width = pad * 2 + cols * colW;
  const height = padT + pad + (rows + 1) * rowH;

  const header = spec.headers
    .map((h, c) => {
      const x = pad + c * colW;
      return `<rect x="${x}" y="${padT}" width="${colW}" height="${rowH}" fill="#e8f5ef" stroke="#c9c2b6"/>
        <text x="${x + colW / 2}" y="${padT + 18}" text-anchor="middle" font-size="11" font-weight="600" font-family="system-ui,sans-serif" fill="#0f6e56">${escapeXml(h.slice(0, 14))}</text>`;
    })
    .join("");

  const body = spec.rows
    .map((row, r) =>
      spec.headers
        .map((_, c) => {
          const cell = row[c] ?? "";
          const x = pad + c * colW;
          const y = padT + (r + 1) * rowH;
          return `<rect x="${x}" y="${y}" width="${colW}" height="${rowH}" fill="#fff" stroke="#c9c2b6"/>
            <text x="${x + colW / 2}" y="${y + 18}" text-anchor="middle" font-size="11" font-family="system-ui,sans-serif" fill="#1c2430">${escapeXml(String(cell).slice(0, 14))}</text>`;
        })
        .join(""),
    )
    .join("");

  return wrapSvg(width, height, `${header}${body}`, spec.title);
}

function renderGraph(spec: Extract<DiagramSpec, { kind: "graph" }>) {
  const n = spec.nodes.length;
  const padT = spec.title ? 40 : 24;
  const size = Math.max(280, Math.min(420, 80 + n * 36));
  const cx = size / 2;
  const cy = padT / 2 + size / 2;
  const radius = size * 0.32;
  const pos = new Map<string, { x: number; y: number }>();
  spec.nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    pos.set(node.id, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  });

  const marker = spec.directed
    ? `<defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#5b6573"/></marker></defs>`
    : "";

  const edges = spec.edges
    .map((e) => {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) return "";
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const inset = 18;
      const x1 = a.x + (dx / len) * inset;
      const y1 = a.y + (dy / len) * inset;
      const x2 = b.x - (dx / len) * inset;
      const y2 = b.y - (dy / len) * inset;
      const label = e.label
        ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle" font-size="10" fill="#5b6573" font-family="system-ui,sans-serif">${escapeXml(e.label)}</text>`
        : "";
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#5b6573" stroke-width="1.5" ${spec.directed ? 'marker-end="url(#arrow)"' : ""}/>${label}`;
    })
    .join("");

  const nodes = spec.nodes
    .map((node) => {
      const p = pos.get(node.id)!;
      const label = node.label ?? node.id;
      return `<circle cx="${p.x}" cy="${p.y}" r="16" fill="#e8f5ef" stroke="#0f6e56" stroke-width="1.5"/>
        <text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="11" font-family="system-ui,sans-serif" fill="#1c2430">${escapeXml(label.slice(0, 6))}</text>`;
    })
    .join("");

  return wrapSvg(size, size + padT / 2, `${marker}${edges}${nodes}`, spec.title);
}

export function renderDiagram(spec: DiagramSpec): string {
  switch (spec.kind) {
    case "scatter":
      return renderScatter(spec);
    case "grid":
      return renderGrid(spec);
    case "tree":
      return renderTree(spec);
    case "kernel":
      return renderKernel(spec);
    case "bars":
      return renderBars(spec);
    case "table":
      return renderTable(spec);
    case "graph":
      return renderGraph(spec);
    default: {
      const _exhaustive: never = spec;
      return _exhaustive;
    }
  }
}

export function figureUrl(problemId: string, figureId: string) {
  return `/api/problems/figures/${encodeURIComponent(problemId)}/${encodeURIComponent(figureId)}`;
}

export function parseFigureInputs(raw: unknown): FigureInput[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: FigureInput[] = [];
  for (const item of raw.slice(0, 6)) {
    const parsed = figureInputSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * Validate figures, render SVGs, replace {{fig:id}} placeholders in text.
 * Throws if placeholders remain unresolved when includeFigures is true,
 * or if figures were required by placeholders but invalid.
 */
export function materializeFigures(params: {
  problemId: string;
  text: string;
  figuresRaw: unknown;
  includeFigures: boolean;
}): { text: string; figures: ProblemFigure[] } {
  const { problemId, includeFigures } = params;
  let text = params.text;

  if (!includeFigures) {
    // Strip placeholders so text-only mode never leaves broken markers.
    text = text.replace(FIG_PLACEHOLDER, "").replace(/\n{3,}/g, "\n\n");
    return { text, figures: [] };
  }

  const inputs = parseFigureInputs(params.figuresRaw);
  const figures: ProblemFigure[] = inputs.map((fig) => ({
    ...fig,
    svg: renderDiagram(fig.diagram),
  }));
  const byId = new Map(figures.map((f) => [f.id, f]));

  text = text.replace(FIG_PLACEHOLDER, (_m, id: string) => {
    const fig = byId.get(id);
    if (!fig) return `{{fig:${id}}}`;
    const alt = fig.alt?.trim() || fig.id;
    return `![${alt}](${figureUrl(problemId, fig.id)})`;
  });

  const unresolved = [...text.matchAll(FIG_PLACEHOLDER)].map((m) => m[1]!);
  if (unresolved.length > 0) {
    throw new Error(
      `Figure placeholder tidak ditemukan: ${unresolved.join(", ")}`,
    );
  }

  // Auto-append unused figures at end (model forgot placeholders).
  const usedIds = new Set(
    [...text.matchAll(/\/api\/problems\/figures\/[^/]+\/([^)\s]+)/g)].map(
      (m) => decodeURIComponent(m[1]!),
    ),
  );
  for (const fig of figures) {
    if (usedIds.has(fig.id)) continue;
    const alt = fig.alt?.trim() || fig.id;
    text = `${text.trim()}\n\n![${alt}](${figureUrl(problemId, fig.id)})`;
  }

  return { text, figures };
}

export function getFigureFromPayload(
  payload: unknown,
  figureId: string,
): ProblemFigure | null {
  if (!payload || typeof payload !== "object") return null;
  const figures = (payload as { figures?: unknown }).figures;
  if (!Array.isArray(figures)) return null;
  for (const item of figures) {
    if (!item || typeof item !== "object") continue;
    const fig = item as Partial<ProblemFigure>;
    if (fig.id !== figureId) continue;
    if (typeof fig.svg === "string" && fig.svg.includes("<svg")) {
      return fig as ProblemFigure;
    }
    const diagram = diagramSpecSchema.safeParse(fig.diagram);
    if (diagram.success) {
      return {
        id: figureId,
        alt: typeof fig.alt === "string" ? fig.alt : undefined,
        diagram: diagram.data,
        svg: renderDiagram(diagram.data),
      };
    }
  }
  return null;
}
