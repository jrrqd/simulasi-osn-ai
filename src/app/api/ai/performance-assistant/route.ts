import { NextRequest } from "next/server";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { requireApiUser, rateLimitForUser } from "@/lib/api";
import {
  PERFORMANCE_ASSISTANT_SYSTEM_PROMPT,
  createUserProvider,
} from "@/lib/ai/provider";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import { buildPerformanceCounselingContext } from "@/lib/analytics/performance-context";

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!(await rateLimitForUser(authResult.user.id, "perf-assistant", 40))) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const messages = body.messages as UIMessage[];

  const settings = await getEffectiveAiSettings(authResult.user.id);
  if (!settings) {
    return Response.json(
      {
        error:
          "AI belum tersedia. Gunakan API key pribadi di Pengaturan atau hubungi admin.",
      },
      { status: 400 },
    );
  }

  const model = createUserProvider({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    modelId: settings.modelId,
  });

  const context = await buildPerformanceCounselingContext(authResult.user.id);
  const result = streamText({
    model,
    system: `${PERFORMANCE_ASSISTANT_SYSTEM_PROMPT}\n\n${context}`,
    messages: await convertToModelMessages(messages),
    abortSignal: AbortSignal.timeout(180_000),
  });

  return result.toUIMessageStreamResponse();
}
