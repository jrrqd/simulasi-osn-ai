import { NextRequest } from "next/server";
import { requireApiUser, rateLimit } from "@/lib/api";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import {
  generateAndStoreProblem,
  parseDifficultyMode,
} from "@/lib/ai/generate-problem";
import { TRACKS, type TrackId } from "@/lib/content/types";

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`gen:${authResult.user.id}`, 8)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const track = String(body.track ?? "B") as TrackId;
  const topic = String(
    body.topic ?? TRACKS[track]?.topics[0] ?? "supervised-learning",
  );
  const difficultyMode = parseDifficultyMode(body.difficultyMode ?? body.difficulty);
  // Legacy numeric difficulty still accepted if difficultyMode omitted and number given.
  const legacyDifficulty =
    body.difficultyMode == null &&
    typeof body.difficulty === "number" &&
    body.difficulty >= 1 &&
    body.difficulty <= 5
      ? (body.difficulty as 1 | 2 | 3 | 4 | 5)
      : undefined;
  const answerType = String(body.answerType ?? "numeric");

  if (!TRACKS[track]) {
    return Response.json({ error: "Track tidak valid" }, { status: 400 });
  }

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

  try {
    const problem = await generateAndStoreProblem({
      userId: authResult.user.id,
      track,
      topic,
      difficultyMode:
        legacyDifficulty != null
          ? legacyDifficulty <= 2
            ? "easy"
            : legacyDifficulty >= 4
              ? "hard"
              : "medium"
          : difficultyMode,
      difficulty: legacyDifficulty,
      answerType,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      modelId: settings.modelId,
    });

    return Response.json({
      problem,
      providerSource: settings.source,
    });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Gagal menghasilkan soal",
      },
      { status: 400 },
    );
  }
}
