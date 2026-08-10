import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api";
import { resolveProblem } from "@/lib/content/shared";
import { toExamFacingProblem } from "@/lib/content/exam-facing-problem";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;

  const { id } = await ctx.params;
  const problem = await resolveProblem(id);
  if (!problem) {
    return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
  }
  return Response.json({ problem: toExamFacingProblem(problem) });
}
