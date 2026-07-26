import { NextRequest } from "next/server";
import { requireApiUser, rateLimit } from "@/lib/api";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import {
  parseDifficultyMode,
  resolveDifficulty,
} from "@/lib/ai/generate-problem";
import { generateAndStoreStudyCase } from "@/lib/ai/generate-study-case";
import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";
import {
  TOPIC_PROMPT_MIN_LEN,
  normalizeTopicPrompt,
  topicPairsFromPrompt,
} from "@/lib/ai/topic-prompt";
import { createNdjsonStreamResponse } from "@/lib/ai/generation-progress";

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`gen-case:${authResult.user.id}`, 4)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const generationMode =
    body.generationMode === "custom" ? "custom" : "standard";
  const difficultyMode = parseDifficultyMode(
    body.difficultyMode ?? body.difficulty,
  );
  const problemCount = Math.min(
    5,
    Math.max(3, Number(body.problemCount) || 4),
  );

  let track: TrackId;
  let topic: string;
  let focusPrompt: string | undefined;

  if (generationMode === "custom") {
    const topicPrompt = normalizeTopicPrompt(body.topicPrompt);
    if (!topicPrompt || topicPrompt.length < TOPIC_PROMPT_MIN_LEN) {
      return Response.json(
        {
          error: `Jelaskan topik/brief studi kasus (minimal ${TOPIC_PROMPT_MIN_LEN} karakter).`,
        },
        { status: 400 },
      );
    }
    const pairs = topicPairsFromPrompt(topicPrompt);
    const pick = pairs[Math.floor(Math.random() * pairs.length)] ?? pairs[0];
    track = pick.track;
    topic = pick.topic;
    focusPrompt = topicPrompt;
  } else {
    track = String(body.track ?? "B") as TrackId;
    topic = String(
      body.topic ?? TRACKS[track]?.topics[0] ?? "supervised-learning",
    );
    if (!TRACKS[track]) {
      return Response.json({ error: "Track tidak valid" }, { status: 400 });
    }
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

  const difficulty = resolveDifficulty(difficultyMode);
  const topicLabel = TOPIC_LABELS[topic] ?? topic;
  const includeFigures =
    body.includeFigures === true ||
    body.includeFigures === "true" ||
    body.includeFigures === 1;

  return createNdjsonStreamResponse(async (send) => {
    await send({
      type: "status",
      message: "Menyiapkan generate studi kasus hAIplay…",
      index: 0,
      total: problemCount,
    });
    await send({
      type: "question_start",
      index: 1,
      total: problemCount,
      track,
      topic,
      topicLabel,
      difficulty,
    });

    const result = await generateAndStoreStudyCase({
      userId: authResult.user.id,
      track,
      topic,
      difficultyMode,
      difficulty,
      problemCount,
      focusPrompt,
      includeFigures,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      modelId: settings.modelId,
      onProgress: send,
    });

    const first = result.problems[0]!;
    // slot_done already emitted per part during generation.
    await send({
      type: "status",
      message: `Studi kasus "${result.caseTitle}" — ${result.problems.length} soal disimpan… caseId=${result.caseId};firstProblemId=${first.id};count=${result.problems.length}`,
      index: result.problems.length,
      total: result.problems.length,
    });
  });
}
