import { NextRequest } from "next/server";
import { requireApiUser, safeContentDispositionFilename } from "@/lib/api";
import { resolveProblem } from "@/lib/content/shared";
import { getCompetitionFile } from "@/lib/competition/competition-spec";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ problemId: string; name: string }> },
) {
  const auth = await requireApiUser(req);
  if ("error" in auth) return auth.error;

  const { problemId, name } = await ctx.params;
  const decoded = decodeURIComponent(name);
  if (decoded.includes("..") || decoded.includes("/") || decoded.includes("\\")) {
    return Response.json({ error: "Nama file tidak valid" }, { status: 400 });
  }

  const problem = await resolveProblem(problemId);
  if (!problem?.competitionSpec) {
    return Response.json(
      { error: "Kompetisi tidak ditemukan" },
      { status: 404 },
    );
  }

  const content = getCompetitionFile(problem.competitionSpec, decoded);
  if (content == null) {
    return Response.json({ error: "File tidak ditemukan" }, { status: 404 });
  }

  const safeName = safeContentDispositionFilename(decoded);
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}
