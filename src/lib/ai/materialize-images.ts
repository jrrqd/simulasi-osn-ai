import { mkdir, realpath, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { generateImage } from "@/lib/ai/image-provider";
import { figureUrl } from "@/lib/ai/diagrams/render";
import type { ProblemImage } from "@/lib/content/types";

const FIG_PLACEHOLDER = /\{\{\s*fig:([a-zA-Z0-9_-]+)\s*\}\}/g;

/** Soft cap per problem (plan default). */
export const MAX_IMAGES_PER_PROBLEM = 4;

export const imagePromptSchema = z.object({
  id: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1).max(32)),
  alt: z.coerce.string().min(1).max(120),
  prompt: z.coerce.string().min(10).max(1500),
});

export type ImagePrompt = z.infer<typeof imagePromptSchema>;

export function parseImagePrompts(raw: unknown): ImagePrompt[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: ImagePrompt[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, MAX_IMAGES_PER_PROBLEM)) {
    const parsed = imagePromptSchema.safeParse(item);
    if (!parsed.success) continue;
    if (seen.has(parsed.data.id)) continue;
    seen.add(parsed.data.id);
    out.push(parsed.data);
  }
  return out;
}

/**
 * Local figures directory.
 * Production VPS default: /var/www/osnai/figures
 * Local / PGlite: .data/figures (relative; resolved at runtime — avoid
 * path.join(process.cwd(), ...) so Turbopack NFT does not trace the whole repo).
 */
export function getFiguresDir(): string {
  const fromEnv = process.env.FIGURES_DIR?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    return "/var/www/osnai/figures";
  }
  return ".data/figures";
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function sniffExt(buf: Buffer, contentType?: string | null): string {
  const mime = contentType?.split(";")[0]?.trim().toLowerCase();
  if (mime && EXT_BY_MIME[mime]) return EXT_BY_MIME[mime]!;
  // PNG magic
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "png";
  }
  // JPEG magic
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpg";
  }
  // WebP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return "png";
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Problem and figure ids used in URLs and on-disk paths. */
export const SAFE_CONTENT_ID = /^[a-zA-Z0-9_-]{1,80}$/;

export function isSafeContentId(value: string) {
  return SAFE_CONTENT_ID.test(value);
}

function staysUnderRoot(root: string, target: string) {
  const rel = path.relative(root, target);
  return (
    rel !== "" &&
    rel !== ".." &&
    !rel.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(rel)
  );
}

/**
 * Find an existing on-disk raster for a figure id (any supported ext).
 * Returns a realpath that stays inside the figures directory, or null.
 */
export async function findRasterFigureFile(
  problemId: string,
  figureId: string,
): Promise<{ absolutePath: string; contentType: string } | null> {
  if (!isSafeContentId(problemId) || !isSafeContentId(figureId)) return null;

  const root = path.resolve(getFiguresDir());
  let realRoot: string;
  try {
    realRoot = await realpath(root);
  } catch {
    return null;
  }

  const candidates: { ext: string; contentType: string }[] = [
    { ext: "png", contentType: "image/png" },
    { ext: "jpg", contentType: "image/jpeg" },
    { ext: "jpeg", contentType: "image/jpeg" },
    { ext: "webp", contentType: "image/webp" },
    { ext: "gif", contentType: "image/gif" },
  ];
  for (const c of candidates) {
    const candidate = path.resolve(root, problemId, `${figureId}.${c.ext}`);
    if (!staysUnderRoot(root, candidate)) continue;
    if (!(await fileExists(candidate))) continue;
    let realFile: string;
    try {
      realFile = await realpath(candidate);
    } catch {
      continue;
    }
    if (!staysUnderRoot(realRoot, realFile)) continue;
    return { absolutePath: realFile, contentType: c.contentType };
  }
  return null;
}

async function persistImageBytes(params: {
  problemId: string;
  figureId: string;
  bytes: Buffer;
  contentType?: string | null;
}): Promise<{ relativeUrl: string; ext: string }> {
  if (
    !isSafeContentId(params.problemId) ||
    !isSafeContentId(params.figureId)
  ) {
    throw new Error("Id gambar tidak valid");
  }
  const ext = sniffExt(params.bytes, params.contentType);
  const root = path.resolve(getFiguresDir());
  const dir = path.resolve(root, params.problemId);
  const absolutePath = path.resolve(dir, `${params.figureId}.${ext}`);
  if (!staysUnderRoot(root, absolutePath)) {
    throw new Error("Path gambar di luar direktori yang diizinkan");
  }
  await mkdir(dir, { recursive: true });
  if (!(await fileExists(absolutePath))) {
    await writeFile(absolutePath, params.bytes);
  }
  return {
    relativeUrl: figureUrl(params.problemId, params.figureId),
    ext,
  };
}

async function downloadToBuffer(
  url: string,
  signal?: AbortSignal,
): Promise<{ bytes: Buffer; contentType: string | null }> {
  const res = await fetch(url, {
    signal: signal ?? AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Gagal unduh gambar (HTTP ${res.status})`);
  }
  const ab = await res.arrayBuffer();
  return {
    bytes: Buffer.from(ab),
    contentType: res.headers.get("content-type"),
  };
}

/**
 * Generate + persist raster images, rewrite {{fig:id}} placeholders in text.
 * Failures for individual images are logged and skipped — never throws for
 * a single bad image so the rest of the problem still stores.
 */
export async function materializeImages(params: {
  problemId: string;
  text: string;
  imagePromptsRaw: unknown;
  baseUrl: string;
  apiKey: string;
}): Promise<{ text: string; images: ProblemImage[] }> {
  const prompts = parseImagePrompts(params.imagePromptsRaw);
  let text = params.text;

  if (prompts.length === 0) {
    return { text, images: [] };
  }

  const images: ProblemImage[] = [];
  const byId = new Map<string, ProblemImage>();

  for (const prompt of prompts) {
    try {
      // Idempotent: reuse existing file on retries.
      const existing = await findRasterFigureFile(
        params.problemId,
        prompt.id,
      );
      if (existing) {
        const image: ProblemImage = {
          id: prompt.id,
          alt: prompt.alt,
          url: figureUrl(params.problemId, prompt.id),
        };
        images.push(image);
        byId.set(prompt.id, image);
        continue;
      }

      const generated = await generateImage({
        prompt: prompt.prompt,
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
        responseFormat: "base64",
        aspectRatio: "1:1",
      });

      let bytes: Buffer;
      let contentType: string | null = "image/png";
      if (generated.base64) {
        bytes = Buffer.from(generated.base64, "base64");
      } else if (generated.url) {
        const downloaded = await downloadToBuffer(generated.url);
        bytes = downloaded.bytes;
        contentType = downloaded.contentType;
      } else {
        throw new Error("Respons gambar kosong");
      }

      const saved = await persistImageBytes({
        problemId: params.problemId,
        figureId: prompt.id,
        bytes,
        contentType,
      });

      const image: ProblemImage = {
        id: prompt.id,
        alt: prompt.alt,
        url: saved.relativeUrl,
      };
      images.push(image);
      byId.set(prompt.id, image);
    } catch (err) {
      console.error("[materialize-images] skip figure", {
        problemId: params.problemId,
        figureId: prompt.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Rewrite placeholders for successfully materialized images.
  text = text.replace(FIG_PLACEHOLDER, (match, id: string) => {
    const img = byId.get(id);
    if (!img) return match;
    return `![${img.alt}](${img.url})`;
  });

  // Auto-append unused images (model forgot placeholders).
  const usedIds = new Set(
    [...text.matchAll(/\/api\/problems\/figures\/[^/]+\/([^)\s]+)/g)].map(
      (m) => decodeURIComponent(m[1]!),
    ),
  );
  for (const img of images) {
    if (usedIds.has(img.id)) continue;
    text = `${text.trim()}\n\n![${img.alt}](${img.url})`;
  }

  // Drop remaining placeholders that failed to materialize so stems stay clean.
  // Leave a small hint so students know a figure was intended.
  text = text
    .replace(FIG_PLACEHOLDER, "_(gambar tidak tersedia)_")
    .replace(/\n{3,}/g, "\n\n");

  return { text, images };
}
