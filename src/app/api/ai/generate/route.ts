import { NextRequest } from "next/server";
import { requireApiUser, rateLimitForUser } from "@/lib/api";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import {
  generateAndStoreProblem,
  parseDifficultyMode,
  resolveDifficulty,
} from "@/lib/ai/generate-problem";
import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";
import {
  TOPIC_PROMPT_MIN_LEN,
  normalizeTopicPrompt,
  topicPairsFromPrompt,
} from "@/lib/ai/topic-prompt";
import { createNdjsonStreamResponse } from "@/lib/ai/generation-progress";
import { loadUserPhase } from "@/lib/user/load-phase";

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!(await rateLimitForUser(authResult.user.id, "gen", 8))) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const generationMode =
    body.generationMode === "custom" ? "custom" : "standard";
  const difficultyMode = parseDifficultyMode(
    body.difficultyMode ?? body.difficulty,
  );
  // Legacy numeric difficulty still accepted if difficultyMode omitted and number given.
  const legacyDifficulty =
    body.difficultyMode == null &&
    typeof body.difficulty === "number" &&
    body.difficulty >= 1 &&
    body.difficulty <= 5
      ? (body.difficulty as 1 | 2 | 3 | 4 | 5)
      : undefined;
  const answerType = String(body.answerType ?? "numeric");
  const includeFigures =
    body.includeFigures === true ||
    body.includeFigures === "true" ||
    body.includeFigures === 1;

  let track: TrackId;
  let topic: string;
  let focusPrompt: string | undefined;

  if (generationMode === "custom") {
    const topicPrompt = normalizeTopicPrompt(body.topicPrompt);
    if (!topicPrompt || topicPrompt.length < TOPIC_PROMPT_MIN_LEN) {
      return Response.json(
        {
          error: `Jelaskan topik/brief soal yang diinginkan (minimal ${TOPIC_PROMPT_MIN_LEN} karakter).`,
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

  const userPhase = await loadUserPhase(authResult.user.id);

  const resolvedDifficultyMode =
    legacyDifficulty != null
      ? legacyDifficulty <= 2
        ? "easy"
        : legacyDifficulty >= 4
          ? "hard"
          : "medium"
      : difficultyMode;
  const difficulty =
    legacyDifficulty ?? resolveDifficulty(resolvedDifficultyMode);
  const topicLabel = TOPIC_LABELS[topic] ?? topic;

  return createNdjsonStreamResponse(async (send) => {
    await send({
      type: "status",
      message:
        generationMode === "custom"
          ? "Menyiapkan generate dari brief topik…"
          : "Menyiapkan generate soal AI…",
      index: 0,
      total: 1,
    });
    await send({
      type: "question_start",
      index: 1,
      total: 1,
      track,
      topic,
      topicLabel,
      difficulty,
    });

    const problem = await generateAndStoreProblem({
      userId: authResult.user.id,
      track,
      topic,
      difficultyMode: resolvedDifficultyMode,
      difficulty: legacyDifficulty,
      answerType,
      focusPrompt,
      includeFigures,
      phase: userPhase,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      modelId: settings.modelId,
      progressIndex: 1,
      onProgress: send,
    });

    await send({
      type: "status",
      message: "Menyimpan soal ke bank AI…",
      index: 1,
      total: 1,
    });
    await send({
      type: "question_done",
      index: 1,
      total: 1,
      title: problem.title,
      topic: problem.topic,
      topicLabel: TOPIC_LABELS[problem.topic] ?? problem.topic,
    });
    await send({
      type: "slot_done",
      phase: "slot",
      planId: "practice-single",
      index: 0,
      problemId: problem.id,
      title: problem.title,
      topic: problem.topic,
      topicLabel: TOPIC_LABELS[problem.topic] ?? problem.topic,
      difficulty: problem.difficulty,
    });
  });
}
