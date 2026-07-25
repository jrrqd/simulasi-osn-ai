import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { generatedMocks } from "@/db/schema";
import { requireApiUser, rateLimit } from "@/lib/api";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import {
  generateAndStoreProblem,
  parseDifficultyMode,
} from "@/lib/ai/generate-problem";
import {
  buildAiMockPlan,
  isAiMockSlot,
  MOCK_QUESTION_COUNT,
  type AiMockAnswerType,
  type AiMockSlot,
} from "@/lib/ai/ai-mock-plan";
import {
  consumeAiMockSession,
  createAiMockSession,
  getAiMockSession,
  setAiMockSessionProblem,
} from "@/lib/ai/ai-mock-sessions";
import {
  normalizeTopicPrompt,
  TOPIC_PROMPT_MIN_LEN,
} from "@/lib/ai/topic-prompt";
import { TRACKS, type TrackId } from "@/lib/content/types";

type Phase = "plan" | "slot" | "commit" | "legacy";

function parsePhase(raw: unknown): Phase {
  if (raw === "plan" || raw === "slot" || raw === "commit") return raw;
  return "legacy";
}

async function generateSlotProblem(params: {
  userId: string;
  slot: AiMockSlot;
  focusPrompt?: string;
  difficultyMode: ReturnType<typeof parseDifficultyMode>;
  baseUrl: string;
  apiKey: string;
  modelId: string;
}) {
  const answerRotation: AiMockAnswerType[] = [
    params.slot.answerType,
    "numeric",
    "mcq",
    "short_string",
  ];
  let lastSlotError: unknown;
  let problem: Awaited<ReturnType<typeof generateAndStoreProblem>> | null =
    null;

  for (let slotAttempt = 0; slotAttempt < 3 && !problem; slotAttempt++) {
    const attemptTopic =
      slotAttempt === 0
        ? params.slot.topic
        : TRACKS[params.slot.track].topics[
            Math.floor(Math.random() * TRACKS[params.slot.track].topics.length)
          ]!;
    // Last attempt drops focusPrompt — brief conflicts are a common JSON-fail trigger.
    const focusPrompt =
      slotAttempt < 2 ? params.focusPrompt : undefined;
    try {
      problem = await generateAndStoreProblem({
        userId: params.userId,
        track: params.slot.track,
        topic: attemptTopic,
        difficultyMode: params.difficultyMode,
        difficulty: params.slot.difficulty,
        focusPrompt,
        answerType: answerRotation[slotAttempt % answerRotation.length],
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
        modelId: params.modelId,
      });
    } catch (err) {
      lastSlotError = err;
    }
  }

  if (!problem) {
    throw lastSlotError instanceof Error
      ? lastSlotError
      : new Error("Gagal menghasilkan soal untuk simulasi AI");
  }
  return problem;
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;

  const body = await req.json();
  const phase = parsePhase(body.phase);

  if (phase === "plan") {
    if (!rateLimit(`gen-mock:${authResult.user.id}`, 2, 60 * 60_000)) {
      return Response.json(
        { error: "Batas generate simulasi: 2 per jam" },
        { status: 429 },
      );
    }

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

    const { slots, meta } = buildAiMockPlan({
      generationMode,
      track: TRACKS[track] ? track : "B",
      difficultyMode,
      topicPrompt,
      preferredTopic,
    });

    const planId = createAiMockSession({
      userId: authResult.user.id,
      slots,
      meta,
    });

    return Response.json({
      phase: "plan",
      planId,
      slots,
      total: slots.length,
      meta: {
        title: meta.title,
        description: meta.description,
        generationMode: meta.generationMode,
        mockTrack: meta.mockTrack,
      },
      providerSource: settings.source,
    });
  }

  if (phase === "slot") {
    // Allow retries across a mock (10 slots × a few attempts).
    if (!rateLimit(`gen-mock-slot:${authResult.user.id}`, 40, 60 * 60_000)) {
      return Response.json(
        { error: "Terlalu banyak permintaan generate soal simulasi" },
        { status: 429 },
      );
    }

    const planId = String(body.planId ?? "");
    const index = Number(body.index);
    const session = getAiMockSession(planId, authResult.user.id);
    if (!session) {
      return Response.json(
        { error: "Sesi generate simulasi tidak ditemukan atau sudah kedaluwarsa." },
        { status: 400 },
      );
    }
    if (!Number.isInteger(index) || index < 0 || index >= session.slots.length) {
      return Response.json({ error: "Index soal tidak valid" }, { status: 400 });
    }

    const existing = session.problemIds[index];
    if (existing) {
      return Response.json({
        phase: "slot",
        planId,
        index,
        problemId: existing,
        reused: true,
      });
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

    const slot = session.slots[index]!;
    try {
      const problem = await generateSlotProblem({
        userId: authResult.user.id,
        slot,
        focusPrompt:
          session.meta.generationMode === "custom"
            ? session.meta.topicPrompt
            : undefined,
        difficultyMode: session.meta.difficultyMode,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        modelId: settings.modelId,
      });
      setAiMockSessionProblem(planId, authResult.user.id, index, problem.id);
      return Response.json({
        phase: "slot",
        planId,
        index,
        problemId: problem.id,
        topic: problem.topic,
        difficulty: problem.difficulty,
      });
    } catch (e) {
      return Response.json(
        {
          error:
            e instanceof Error ? e.message : "Gagal menghasilkan soal simulasi",
          index,
        },
        { status: 400 },
      );
    }
  }

  if (phase === "commit") {
    if (!rateLimit(`gen-mock-commit:${authResult.user.id}`, 6, 60 * 60_000)) {
      return Response.json(
        { error: "Terlalu banyak permintaan commit simulasi" },
        { status: 429 },
      );
    }

    const planId = String(body.planId ?? "");
    const session = consumeAiMockSession(planId, authResult.user.id);
    if (!session) {
      return Response.json(
        { error: "Sesi generate simulasi tidak ditemukan atau sudah kedaluwarsa." },
        { status: 400 },
      );
    }

    const problemIds = session.problemIds;
    if (problemIds.some((id) => !id)) {
      return Response.json(
        {
          error: `Belum lengkap: ${problemIds.filter(Boolean).length}/${problemIds.length} soal siap.`,
        },
        { status: 400 },
      );
    }

    const id = `aimock-${nanoid(10)}`;
    const db = await getDb();
    await db.insert(generatedMocks).values({
      id,
      createdBy: authResult.user.id,
      title: session.meta.title,
      description: session.meta.description,
      durationMinutes: 30,
      difficultyMode: session.meta.difficultyMode,
      problemIds: problemIds as string[],
      track: session.meta.mockTrack,
      kind: "ai",
    });

    return Response.json({
      mock: {
        id,
        title: session.meta.title,
        description: session.meta.description,
        durationMinutes: 30,
        problemIds,
        track: session.meta.mockTrack,
        difficultyMode: session.meta.difficultyMode,
        source: "ai" as const,
        generationMode: session.meta.generationMode,
        topics: session.slots.map((s) => s.topic),
      },
    });
  }

  // Legacy single-request path (kept for compatibility). Prefer plan/slot/commit
  // from the UI — one nginx-proxied request cannot finish 10 MiniMax calls.
  if (!rateLimit(`gen-mock:${authResult.user.id}`, 2, 60 * 60_000)) {
    return Response.json(
      { error: "Batas generate simulasi: 2 per jam" },
      { status: 429 },
    );
  }

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

  try {
    const { slots, meta } = buildAiMockPlan({
      generationMode,
      track: TRACKS[track] ? track : "B",
      difficultyMode,
      topicPrompt,
      preferredTopic,
    });

    const problemIds: string[] = [];
    const difficulties: number[] = [];
    const usedTopics = new Set<string>();

    for (const slot of slots) {
      if (!isAiMockSlot(slot)) {
        throw new Error("Rencana soal tidak valid");
      }
      const problem = await generateSlotProblem({
        userId: authResult.user.id,
        slot,
        focusPrompt:
          generationMode === "custom" ? topicPrompt : undefined,
        difficultyMode,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        modelId: settings.modelId,
      });
      problemIds.push(problem.id);
      difficulties.push(problem.difficulty);
      usedTopics.add(problem.topic);
    }

    if (problemIds.length !== MOCK_QUESTION_COUNT) {
      throw new Error("Jumlah soal simulasi tidak lengkap");
    }

    const id = `aimock-${nanoid(10)}`;
    const db = await getDb();
    await db.insert(generatedMocks).values({
      id,
      createdBy: authResult.user.id,
      title: meta.title,
      description: meta.description,
      durationMinutes: 30,
      difficultyMode,
      problemIds,
      track: meta.mockTrack,
      kind: "ai",
    });

    return Response.json({
      mock: {
        id,
        title: meta.title,
        description: meta.description,
        durationMinutes: 30,
        problemIds,
        track: meta.mockTrack,
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
