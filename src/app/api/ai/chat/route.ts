import { NextRequest } from "next/server";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { requireApiUser, rateLimitForUser } from "@/lib/api";
import {
  REVIEW_SYSTEM_PROMPT,
  createUserProvider,
} from "@/lib/ai/provider";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import { resolveProblem } from "@/lib/content/shared";

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!(await rateLimitForUser(authResult.user.id, "chat", 30))) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const problemId = String(body.problemId ?? "");
  const studentAnswer = body.studentAnswer;
  const messages = body.messages as UIMessage[];

  const problem = await resolveProblem(problemId);
  if (!problem) {
    return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
  }

  const settings = await getEffectiveAiSettings(authResult.user.id);
  if (!settings) {
    return Response.json(
      {
        error:
          "AI belum tersedia. Gunakan API key pribadi atau hubungi admin.",
      },
      { status: 400 },
    );
  }

  const model = createUserProvider({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    modelId: settings.modelId,
  });

  const context = `SOAL:
${problem.title}
${problem.stem}

JAWABAN BENAR:
${JSON.stringify(problem.answer ?? problem.parts)}

SOLUSI:
${problem.solution}

JAWABAN SISWA:
${JSON.stringify(studentAnswer)}`;

  const result = streamText({
    model,
    system: `${REVIEW_SYSTEM_PROMPT}\n\n${context}`,
    messages: await convertToModelMessages(messages),
    // Reasoning models (MiniMax M3) can think for a while before answering.
    abortSignal: AbortSignal.timeout(180_000),
  });

  return result.toUIMessageStreamResponse();
}
