import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { generatedMocks } from "@/db/schema";
import { requireApiUser, rateLimitForUser } from "@/lib/api";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import { assertSimulasiAllowed } from "@/lib/ai/simulasi-quota";
import { loadUserAccess } from "@/lib/user/load-user-access";
import { parseDifficultyMode } from "@/lib/ai/difficulty";
import {
  assembleCuratedMockWithLlm,
  type CuratedMockSize,
} from "@/lib/ai/assemble-curated-mock";
import {
  normalizeTopicPrompt,
  TOPIC_PROMPT_MIN_LEN,
} from "@/lib/ai/topic-prompt";
import { TRACKS, type TrackId } from "@/lib/content/types";

function parseSize(raw: unknown): CuratedMockSize {
  return raw === "full" ? "full" : "half";
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;

  const access = await loadUserAccess(authResult.user.id);
  if (
    !(await rateLimitForUser(
      authResult.user.id,
      "gen-curated-mock",
      4,
      60 * 60_000,
      access,
    ))
  ) {
    return Response.json(
      { error: "Batas susun simulasi curated: 4 per jam" },
      { status: 429 },
    );
  }

  const body = await req.json();
  const difficultyMode = parseDifficultyMode(body.difficultyMode);
  const size = parseSize(body.size);
  const generationMode =
    body.generationMode === "custom" ? "custom" : "standard";
  const topicPrompt = normalizeTopicPrompt(body.topicPrompt);

  if (generationMode === "custom") {
    if (!topicPrompt || topicPrompt.length < TOPIC_PROMPT_MIN_LEN) {
      return Response.json(
        {
          error: `Jelaskan topik yang diinginkan (minimal ${TOPIC_PROMPT_MIN_LEN} karakter).`,
        },
        { status: 400 },
      );
    }
  }

  const trackRaw = body.track != null ? String(body.track) : "ALL";
  const trackFilter =
    generationMode === "custom"
      ? undefined
      : trackRaw !== "ALL" && TRACKS[trackRaw as TrackId]
        ? (trackRaw as TrackId)
        : undefined;

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

  if (access) {
    const blocked = await assertSimulasiAllowed(
      authResult.user.id,
      access,
      settings,
    );
    if (blocked) return blocked;
  }

  try {
    const assembled = await assembleCuratedMockWithLlm({
      difficultyMode,
      size,
      trackFilter,
      topicPrompt: generationMode === "custom" ? topicPrompt : undefined,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      modelId: settings.modelId,
    });

    const id = `curatedmock-${nanoid(10)}`;
    const db = await getDb();
    await db.insert(generatedMocks).values({
      id,
      createdBy: authResult.user.id,
      title: assembled.title,
      description: assembled.description,
      durationMinutes: assembled.durationMinutes,
      difficultyMode,
      problemIds: assembled.problemIds,
      track: trackFilter ?? "ALL",
      kind: "curated_assembled",
    });

    return Response.json({
      mock: {
        id,
        title: assembled.title,
        description: assembled.description,
        durationMinutes: assembled.durationMinutes,
        problemIds: assembled.problemIds,
        track: trackFilter ?? "ALL",
        difficultyMode,
        kind: "curated_assembled" as const,
        source: "ai" as const,
        usedFallback: assembled.usedFallback,
        preferredTopics: assembled.preferredTopics,
        generationMode,
      },
      providerSource: settings.source,
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Gagal menyusun simulasi curated",
      },
      { status: 400 },
    );
  }
}
