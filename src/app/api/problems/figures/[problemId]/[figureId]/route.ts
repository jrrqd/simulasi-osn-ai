import { readFile } from "node:fs/promises";
import { getGeneratedProblem } from "@/lib/content/shared";
import { getFigureFromPayload } from "@/lib/ai/diagrams";
import { findRasterFigureFile } from "@/lib/ai/materialize-images";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ problemId: string; figureId: string }> },
) {
  const { problemId, figureId } = await ctx.params;
  if (!problemId || !figureId) {
    return new Response("Not found", { status: 404 });
  }

  // Prefer on-disk raster (MiniMax image-01 / persisted downloads).
  const raster = await findRasterFigureFile(problemId, figureId);
  if (raster) {
    const bytes = await readFile(raster.absolutePath);
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": raster.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  // Fall back to inline SVG diagram specs stored in the problem payload.
  const problem = await getGeneratedProblem(problemId);
  if (!problem) {
    return new Response("Not found", { status: 404 });
  }

  const fig = getFigureFromPayload(problem, figureId);
  if (!fig?.svg) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(fig.svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
