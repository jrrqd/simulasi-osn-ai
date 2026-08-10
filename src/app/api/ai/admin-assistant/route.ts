import { NextRequest } from "next/server";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { requireApiAdmin, rateLimitForUser } from "@/lib/api";
import {
  ADMIN_ASSISTANT_SYSTEM_PROMPT,
  createUserProvider,
} from "@/lib/ai/provider";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import { buildAdminAssistantContext } from "@/lib/admin/analytics";
import { buildAdminPageContext } from "@/lib/admin/page-context";

export async function POST(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!(await rateLimitForUser(authResult.user.id, "admin-assistant", 40))) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const messages = body.messages as UIMessage[];
  const focusUserId =
    typeof body.focusUserId === "string" && body.focusUserId
      ? body.focusUserId
      : undefined;
  const pathname =
    typeof body.pathname === "string" && body.pathname
      ? body.pathname.slice(0, 400)
      : undefined;
  const search =
    typeof body.search === "string" && body.search
      ? body.search.slice(0, 400)
      : undefined;

  const settings = await getEffectiveAiSettings(authResult.user.id);
  if (!settings) {
    return Response.json(
      {
        error:
          "AI belum tersedia. Atur LLM bersama di Admin → LLM Bersama atau pasang API key di Pengaturan.",
      },
      { status: 400 },
    );
  }

  const model = createUserProvider({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    modelId: settings.modelId,
  });

  const [platformContext, pageContext] = await Promise.all([
    buildAdminAssistantContext(focusUserId),
    buildAdminPageContext({ pathname, search, focusUserId }),
  ]);

  const result = streamText({
    model,
    system: `${ADMIN_ASSISTANT_SYSTEM_PROMPT}\n\n${pageContext}\n\n${platformContext}`,
    messages: await convertToModelMessages(messages),
    abortSignal: AbortSignal.timeout(180_000),
  });

  return result.toUIMessageStreamResponse();
}
