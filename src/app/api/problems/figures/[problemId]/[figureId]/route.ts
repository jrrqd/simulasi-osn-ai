import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api";
import { getGeneratedProblem } from "@/lib/content/shared";
import { getFigureFromPayload } from "@/lib/ai/diagrams";
import {
  findRasterFigureFile,
  isSafeContentId,
} from "@/lib/ai/materialize-images";

const PRIVATE_CACHE = "private, no-store";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ problemId: string; figureId: string }> },
) {
  const auth = await requireApiUser(req);
  if ("error" in auth) return auth.error;

  const { problemId, figureId } = await ctx.params;
  const pid = decodeURIComponent(problemId);
  const fid = decodeURIComponent(figureId);
  if (!isSafeContentId(pid) || !isSafeContentId(fid)) {
    return new Response("Not found", { status: 404 });
  }

  const raster = await findRasterFigureFile(pid, fid);
  if (raster) {
    const bytes = await readFile(raster.absolutePath);
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": raster.contentType,
        "Cache-Control": PRIVATE_CACHE,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const problem = await getGeneratedProblem(pid);
  if (!problem) {
    return new Response("Not found", { status: 404 });
  }

  const fig = getFigureFromPayload(problem, fid);
  if (!fig?.svg) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(fig.svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": PRIVATE_CACHE,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
