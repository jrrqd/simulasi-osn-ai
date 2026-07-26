import { getGeneratedProblem } from "@/lib/content/shared";
import { getFigureFromPayload } from "@/lib/ai/diagrams";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ problemId: string; figureId: string }> },
) {
  const { problemId, figureId } = await ctx.params;
  if (!problemId || !figureId) {
    return new Response("Not found", { status: 404 });
  }

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
