import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api";
import { resolveProblem } from "@/lib/content/shared";
import { buildStarterNotebook } from "@/lib/notebook/build-starter-notebook";
import { parseCompetitionSpec } from "@/lib/competition/competition-spec";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ problemId: string }> },
) {
  const auth = await requireApiUser(req);
  if ("error" in auth) return auth.error;

  const { problemId } = await ctx.params;
  const problem = await resolveProblem(problemId);
  if (!problem?.competitionSpec) {
    return Response.json(
      { error: "Kompetisi tidak ditemukan" },
      { status: 404 },
    );
  }

  const competition =
    parseCompetitionSpec(problem.competitionSpec) ?? problem.competitionSpec;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || undefined;
  const notebook = buildStarterNotebook({
    problem,
    competition,
    appUrl,
  });

  const safeName =
    problem.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "competition";

  return new Response(notebook, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ipynb+json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.ipynb"`,
      "Cache-Control": "no-store",
    },
  });
}
