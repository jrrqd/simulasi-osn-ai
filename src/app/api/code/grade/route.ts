import { requireApiUser, rateLimit } from "@/lib/api";
import { resolveProblem } from "@/lib/content/shared";
import {
  GraderUnavailableError,
  gradeCodeWithJudge0,
} from "@/lib/grading/judge0";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`code-grade:${authResult.user.id}`, 10, 60_000)) {
    return Response.json(
      { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const problemId = String(body?.problemId ?? "");
  const userCode = String(body?.userCode ?? "");
  if (!problemId || !userCode || userCode.length > 100_000) {
    return Response.json({ error: "Kode tidak valid" }, { status: 400 });
  }

  const problem = await resolveProblem(problemId);
  if (!problem?.codeSpec || problem.answerType !== "codeSpec") {
    return Response.json(
      { error: "Soal ini tidak mendukung penilaian kode" },
      { status: 400 },
    );
  }

  try {
    const result = await gradeCodeWithJudge0({
      codeSpec: problem.codeSpec,
      userCode,
    });
    return Response.json({ result });
  } catch (error) {
    if (error instanceof GraderUnavailableError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    return Response.json(
      { error: "Layanan penilaian kode sedang tidak tersedia" },
      { status: 503 },
    );
  }
}
