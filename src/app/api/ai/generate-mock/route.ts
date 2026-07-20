import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { generatedMocks } from "@/db/schema";
import { requireApiUser, rateLimit } from "@/lib/api";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import {
  generateAndStoreProblem,
  pickTopicForTrack,
  parseDifficultyMode,
  resolveDifficulty,
  labelDifficultyMode,
} from "@/lib/ai/generate-problem";
import { TRACKS, type TrackId } from "@/lib/content/types";

const MOCK_QUESTION_COUNT = 10;
const MOCK_DURATION_MINUTES = 30;

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  // 2 mocks / hour
  if (!rateLimit(`gen-mock:${authResult.user.id}`, 2, 60 * 60_000)) {
    return Response.json(
      { error: "Batas generate simulasi: 2 per jam" },
      { status: 429 },
    );
  }

  const body = await req.json();
  const track = String(body.track ?? "B") as TrackId;
  const difficultyMode = parseDifficultyMode(body.difficultyMode);
  const preferredTopic =
    body.topic != null ? String(body.topic) : undefined;

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
    const problemIds: string[] = [];
    const difficulties: number[] = [];

    for (let i = 0; i < MOCK_QUESTION_COUNT; i++) {
      const difficulty = resolveDifficulty(difficultyMode);
      const topic = pickTopicForTrack(track, preferredTopic);
      const problem = await generateAndStoreProblem({
        userId: authResult.user.id,
        track,
        topic,
        difficultyMode,
        difficulty,
        answerType: ["numeric", "mcq", "short_string", "python_output"][
          i % 4
        ],
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        modelId: settings.modelId,
      });
      problemIds.push(problem.id);
      difficulties.push(problem.difficulty);
    }

    const id = `aimock-${nanoid(10)}`;
    const title = `Simulasi AI · Track ${track} · ${labelDifficultyMode(difficultyMode)}`;
    const description = `10 soal AI bersama (${MOCK_DURATION_MINUTES} menit). Dibuat otomatis; dapat dikerjakan semua siswa.`;

    const db = await getDb();
    await db.insert(generatedMocks).values({
      id,
      createdBy: authResult.user.id,
      title,
      description,
      durationMinutes: MOCK_DURATION_MINUTES,
      difficultyMode,
      problemIds,
      track,
      kind: "ai",
    });

    return Response.json({
      mock: {
        id,
        title,
        description,
        durationMinutes: MOCK_DURATION_MINUTES,
        problemIds,
        track,
        difficultyMode,
        source: "ai" as const,
        difficulties,
      },
      providerSource: settings.source,
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error ? e.message : "Gagal menghasilkan simulasi AI",
      },
      { status: 400 },
    );
  }
}
