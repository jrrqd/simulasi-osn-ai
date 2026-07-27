import { z } from "zod";

const pointSchema = z.object({
  x: z.coerce.number(),
  y: z.coerce.number(),
  label: z.coerce.string().optional(),
  /** Class / series key for color (e.g. "A", "0", "pos"). */
  group: z.coerce.string().optional(),
});

const scatterSchema = z.object({
  kind: z.literal("scatter"),
  title: z.coerce.string().optional(),
  xLabel: z.coerce.string().optional(),
  yLabel: z.coerce.string().optional(),
  points: z.array(pointSchema).min(1).max(80),
  lines: z
    .array(
      z.object({
        x1: z.coerce.number(),
        y1: z.coerce.number(),
        x2: z.coerce.number(),
        y2: z.coerce.number(),
        label: z.coerce.string().optional(),
      }),
    )
    .max(8)
    .optional(),
});

const gridSchema = z.object({
  kind: z.literal("grid"),
  title: z.coerce.string().optional(),
  /** Row-major cells; 0–1 for bw, or any number for heatmap. */
  cells: z.array(z.array(z.coerce.number())).min(1).max(32),
  palette: z.enum(["bw", "heatmap"]).catch("bw"),
  showValues: z.boolean().optional(),
});

const treeNodeSchema = z.object({
  id: z.coerce.string().min(1),
  label: z.coerce.string().min(1),
  /** Optional leaf class highlight. */
  leaf: z.boolean().optional(),
});

const treeSchema = z.object({
  kind: z.literal("tree"),
  title: z.coerce.string().optional(),
  nodes: z.array(treeNodeSchema).min(1).max(24),
  edges: z
    .array(
      z.object({
        from: z.coerce.string().min(1),
        to: z.coerce.string().min(1),
        label: z.coerce.string().optional(),
      }),
    )
    .max(32),
});

const kernelSchema = z.object({
  kind: z.literal("kernel"),
  title: z.coerce.string().optional(),
  matrix: z.array(z.array(z.coerce.number())).min(1).max(7),
});

const barsSchema = z.object({
  kind: z.literal("bars"),
  title: z.coerce.string().optional(),
  yLabel: z.coerce.string().optional(),
  bars: z
    .array(
      z.object({
        label: z.coerce.string().min(1),
        value: z.coerce.number(),
      }),
    )
    .min(1)
    .max(16),
});

const tableSchema = z.object({
  kind: z.literal("table"),
  title: z.coerce.string().optional(),
  headers: z.array(z.coerce.string()).min(1).max(8),
  rows: z.array(z.array(z.coerce.string())).min(1).max(16),
});

const graphSchema = z.object({
  kind: z.literal("graph"),
  title: z.coerce.string().optional(),
  directed: z.boolean().optional(),
  nodes: z
    .array(
      z.object({
        id: z.coerce.string().min(1),
        label: z.coerce.string().optional(),
      }),
    )
    .min(1)
    .max(12),
  edges: z
    .array(
      z.object({
        from: z.coerce.string().min(1),
        to: z.coerce.string().min(1),
        label: z.coerce.string().optional(),
      }),
    )
    .max(24),
});

export const diagramSpecSchema = z.discriminatedUnion("kind", [
  scatterSchema,
  gridSchema,
  treeSchema,
  kernelSchema,
  barsSchema,
  tableSchema,
  graphSchema,
]);

export type DiagramSpec = z.infer<typeof diagramSpecSchema>;

export const figureInputSchema = z.object({
  id: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1).max(32)),
  alt: z.coerce.string().max(120).optional(),
  diagram: diagramSpecSchema,
});

export type FigureInput = z.infer<typeof figureInputSchema>;

export type ProblemFigure = FigureInput & { svg: string };

/** Topics that usually need a visual in PREDIKSI-style problems. */
export const VISUAL_TOPICS = new Set([
  "supervised-learning",
  "unsupervised-learning",
  "feature-engineering",
  "konvolusi",
  "klasifikasi-citra",
  "evaluasi-model",
  "transformer-dasar",
]);

export function defaultIncludeFigures(topic: string): boolean {
  return VISUAL_TOPICS.has(topic);
}
