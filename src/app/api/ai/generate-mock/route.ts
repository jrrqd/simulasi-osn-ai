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
import {
  matchTopicsFromPrompt,
  normalizeTopicPrompt,
  topicPairsFromPrompt,
  TOPIC_PROMPT_MIN_LEN,
} from "@/lib/ai/topic-prompt";
import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";

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
  const generationMode =
    body.generationMode === "custom" ? "custom" : "standard";
  const difficultyMode = parseDifficultyMode(body.difficultyMode);
  const topicPrompt = normalizeTopicPrompt(body.topicPrompt);
  const preferredTopic =
    body.topic != null ? String(body.topic) : undefined;

  let track = String(body.track ?? "B") as TrackId;
  if (generationMode === "custom") {
    if (!topicPrompt || topicPrompt.length < TOPIC_PROMPT_MIN_LEN) {
      return Response.json(
        {
          error: `Jelaskan topik/brief kuis yang diinginkan (minimal ${TOPIC_PROMPT_MIN_LEN} karakter).`,
        },
        { status: 400 },
      );
    }
  } else if (!TRACKS[track]) {
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

  const topicPairs =
    generationMode === "custom" && topicPrompt
      ? topicPairsFromPrompt(topicPrompt, TRACKS[track] ? track : "B")
      : null;

  if (topicPairs && topicPairs.length > 0) {
    track = topicPairs[0]!.track;
  }

  try {
    const problemIds: string[] = [];
    const difficulties: number[] = [];
    const usedTopics = new Set<string>();
    // Prefer types that stay JSON-safe; python_output often breaks MiniMax JSON.
    const answerTypes = ["numeric", "mcq", "short_string", "numeric"] as const;

    for (let i = 0; i < MOCK_QUESTION_COUNT; i++) {
      const difficulty = resolveDifficulty(difficultyMode);
      let questionTrack = track;
      let topic: string;

      if (topicPairs && topicPairs.length > 0) {
        const pair = topicPairs[i % topicPairs.length]!;
        questionTrack = pair.track;
        topic = pair.topic;
      } else {
        topic = pickTopicForTrack(track, preferredTopic);
      }

      let problem = null as Awaited<
        ReturnType<typeof generateAndStoreProblem>
      > | null;
      let lastSlotError: unknown;
      for (let slotAttempt = 0; slotAttempt < 3 && !problem; slotAttempt++) {
        const attemptTopic =
          slotAttempt === 0
            ? topic
            : pickTopicForTrack(questionTrack, preferredTopic);
        try {
          problem = await generateAndStoreProblem({
            userId: authResult.user.id,
            track: questionTrack,
            topic: attemptTopic,
            difficultyMode,
            difficulty,
            focusPrompt:
              generationMode === "custom" ? topicPrompt : undefined,
            answerType: answerTypes[(i + slotAttempt) % answerTypes.length],
            baseUrl: settings.baseUrl,
            apiKey: settings.apiKey,
            modelId: settings.modelId,
          });
          usedTopics.add(attemptTopic);
        } catch (err) {
          lastSlotError = err;
        }
      }
      if (!problem) {
        throw lastSlotError instanceof Error
          ? lastSlotError
          : new Error("Gagal menghasilkan soal untuk simulasi AI");
      }
      problemIds.push(problem.id);
      difficulties.push(problem.difficulty);
    }

    const preferred = topicPrompt
      ? matchTopicsFromPrompt(topicPrompt)
      : [];
    const topicLabel =
      preferred.length > 0
        ? preferred
            .slice(0, 3)
            .map((t) => TOPIC_LABELS[t] ?? t)
            .join(", ")
        : null;

    const id = `aimock-${nanoid(10)}`;
    const title =
      generationMode === "custom"
        ? `Simulasi AI · Custom${topicLabel ? ` · ${topicLabel}` : " topik"}`
        : `Simulasi AI · Track ${track} · ${labelDifficultyMode(difficultyMode)}`;
    const description =
      generationMode === "custom" && topicPrompt
        ? `10 soal AI bersama (${MOCK_DURATION_MINUTES} menit) mengikuti brief: ${topicPrompt.slice(0, 180)}`
        : `10 soal AI bersama (${MOCK_DURATION_MINUTES} menit). Dibuat otomatis; dapat dikerjakan semua siswa.`;

    const db = await getDb();
    await db.insert(generatedMocks).values({
      id,
      createdBy: authResult.user.id,
      title,
      description,
      durationMinutes: MOCK_DURATION_MINUTES,
      difficultyMode,
      problemIds,
      track: generationMode === "custom" ? "ALL" : track,
      kind: "ai",
    });

    return Response.json({
      mock: {
        id,
        title,
        description,
        durationMinutes: MOCK_DURATION_MINUTES,
        problemIds,
        track: generationMode === "custom" ? "ALL" : track,
        difficultyMode,
        source: "ai" as const,
        difficulties,
        generationMode,
        topics: [...usedTopics],
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
