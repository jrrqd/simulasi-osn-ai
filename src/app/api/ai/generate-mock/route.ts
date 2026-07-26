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
import { generateAndStoreStudyCase } from "@/lib/ai/generate-study-case";
import {
  createNdjsonStreamResponse,
  type GenerationProgressHandler,
} from "@/lib/ai/generation-progress";
import {
  buildAiMockPlan,
  isAiMockSlot,
  MOCK_QUESTION_COUNT,
  parseAiMockSize,
  type AiMockAnswerType,
  type AiMockSlot,
} from "@/lib/ai/ai-mock-plan";
import {
  consumeAiMockSession,
  createAiMockSession,
  getAiMockSession,
  setAiMockSessionProblem,
  setAiMockSessionProblems,
} from "@/lib/ai/ai-mock-sessions";
import {
  normalizeTopicPrompt,
  TOPIC_PROMPT_MIN_LEN,
} from "@/lib/ai/topic-prompt";
import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";

type Phase = "plan" | "slot" | "case" | "commit" | "legacy";

function parsePhase(raw: unknown): Phase {
  if (
    raw === "plan" ||
    raw === "slot" ||
    raw === "case" ||
    raw === "commit"
  ) {
    return raw;
  }
  return "legacy";
}

function parseGenerationMode(
  raw: unknown,
): "standard" | "custom" | "study-case" {
  if (raw === "custom" || raw === "study-case") return raw;
  return "standard";
}

async function generateSlotProblem(params: {
  userId: string;
  slot: AiMockSlot;
  focusPrompt?: string;
  difficultyMode: ReturnType<typeof parseDifficultyMode>;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  progressIndex?: number;
  progressTotal?: number;
  onProgress?: GenerationProgressHandler;
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
  const progressIndex = params.progressIndex ?? 1;
  const progressTotal = params.progressTotal ?? MOCK_QUESTION_COUNT;

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
    if (slotAttempt > 0) {
      await params.onProgress?.({
        type: "status",
        message: `Mencoba ulang soal ${progressIndex} dengan topik lain…`,
        index: progressIndex,
        total: progressTotal,
      });
      await params.onProgress?.({
        type: "question_start",
        index: progressIndex,
        total: progressTotal,
        track: params.slot.track,
        topic: attemptTopic,
        topicLabel: TOPIC_LABELS[attemptTopic] ?? attemptTopic,
        difficulty: params.slot.difficulty,
        attempt: slotAttempt + 1,
      });
    }
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
        progressIndex,
        onProgress: params.onProgress,
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

    const generationMode = parseGenerationMode(body.generationMode);
    const difficultyMode = parseDifficultyMode(body.difficultyMode);
    const topicPrompt = normalizeTopicPrompt(body.topicPrompt);
    const preferredTopic =
      body.topic != null ? String(body.topic) : undefined;
    const size = parseAiMockSize(body.size);

    const rawTrack = String(body.track ?? "B");
    const track: TrackId | "ALL" =
      rawTrack === "ALL"
        ? "ALL"
        : TRACKS[rawTrack as TrackId]
          ? (rawTrack as TrackId)
          : "B";

    if (generationMode === "custom") {
      if (!topicPrompt || topicPrompt.length < TOPIC_PROMPT_MIN_LEN) {
        return Response.json(
          {
            error: `Jelaskan topik/brief kuis yang diinginkan (minimal ${TOPIC_PROMPT_MIN_LEN} karakter).`,
          },
          { status: 400 },
        );
      }
    } else if (track !== "ALL" && !TRACKS[track]) {
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

    const { slots, cases, meta } = buildAiMockPlan({
      generationMode,
      track,
      difficultyMode,
      topicPrompt,
      preferredTopic,
      size,
    });

    if (generationMode === "study-case" && cases.length === 0) {
      return Response.json(
        { error: "Gagal menyusun paket studi kasus untuk ukuran ini." },
        { status: 400 },
      );
    }

    const planId = createAiMockSession({
      userId: authResult.user.id,
      slots,
      cases,
      meta,
    });

    return Response.json({
      phase: "plan",
      planId,
      slots,
      cases,
      total: slots.length,
      totalCases: cases.length,
      meta: {
        title: meta.title,
        description: meta.description,
        generationMode: meta.generationMode,
        mockTrack: meta.mockTrack,
        questionCount: meta.questionCount,
        durationMinutes: meta.durationMinutes,
        size: meta.size,
      },
      providerSource: settings.source,
    });
  }

  if (phase === "slot") {
    // Allow retries across a full mock (40 slots × a few attempts).
    if (!rateLimit(`gen-mock-slot:${authResult.user.id}`, 120, 60 * 60_000)) {
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
    const slot = session.slots[index]!;
    const total = session.slots.length;

    if (existing) {
      return createNdjsonStreamResponse(async (send) => {
        await send({
          type: "slot_done",
          phase: "slot",
          planId,
          index,
          problemId: existing,
          title: `Soal ${index + 1}`,
          topic: slot.topic,
          topicLabel: TOPIC_LABELS[slot.topic] ?? slot.topic,
          difficulty: slot.difficulty,
          reused: true,
        });
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

    return createNdjsonStreamResponse(async (send) => {
      await send({
        type: "question_start",
        index: index + 1,
        total,
        track: slot.track,
        topic: slot.topic,
        topicLabel: TOPIC_LABELS[slot.topic] ?? slot.topic,
        difficulty: slot.difficulty,
      });

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
        progressIndex: index + 1,
        progressTotal: total,
        onProgress: send,
      });
      setAiMockSessionProblem(planId, authResult.user.id, index, problem.id);
      await send({
        type: "question_done",
        index: index + 1,
        total,
        title: problem.title,
        topic: problem.topic,
        topicLabel: TOPIC_LABELS[problem.topic] ?? problem.topic,
      });
      await send({
        type: "slot_done",
        phase: "slot",
        planId,
        index,
        problemId: problem.id,
        title: problem.title,
        topic: problem.topic,
        topicLabel: TOPIC_LABELS[problem.topic] ?? problem.topic,
        difficulty: problem.difficulty,
      });
    });
  }

  if (phase === "case") {
    if (!rateLimit(`gen-mock-case:${authResult.user.id}`, 40, 60 * 60_000)) {
      return Response.json(
        { error: "Terlalu banyak permintaan generate studi kasus simulasi" },
        { status: 429 },
      );
    }

    const planId = String(body.planId ?? "");
    const caseIndex = Number(body.caseIndex);
    const session = getAiMockSession(planId, authResult.user.id);
    if (!session) {
      return Response.json(
        {
          error:
            "Sesi generate simulasi tidak ditemukan atau sudah kedaluwarsa.",
        },
        { status: 400 },
      );
    }
    if (session.meta.generationMode !== "study-case") {
      return Response.json(
        { error: "Sesi ini bukan mode studi kasus." },
        { status: 400 },
      );
    }
    const caseSlot = session.cases[caseIndex];
    if (
      !caseSlot ||
      !Number.isInteger(caseIndex) ||
      caseIndex < 0 ||
      caseIndex >= session.cases.length
    ) {
      return Response.json(
        { error: "Index studi kasus tidak valid" },
        { status: 400 },
      );
    }

    const totalProblems = session.slots.length;
    const already = session.problemIds
      .slice(caseSlot.startIndex, caseSlot.startIndex + caseSlot.problemCount)
      .every(Boolean);
    if (already) {
      return createNdjsonStreamResponse(async (send) => {
        for (let i = 0; i < caseSlot.problemCount; i++) {
          const problemId = session.problemIds[caseSlot.startIndex + i]!;
          const slot = session.slots[caseSlot.startIndex + i]!;
          await send({
            type: "slot_done",
            phase: "slot",
            planId,
            index: caseSlot.startIndex + i,
            problemId,
            title: `Soal ${caseSlot.startIndex + i + 1}`,
            topic: slot.topic,
            topicLabel: TOPIC_LABELS[slot.topic] ?? slot.topic,
            difficulty: slot.difficulty,
            reused: true,
          });
        }
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

    return createNdjsonStreamResponse(async (send) => {
      await send({
        type: "status",
        message: `Menyusun studi kasus ${caseIndex + 1}/${session.cases.length} (${caseSlot.problemCount} soal)…`,
        index: caseSlot.startIndex + 1,
        total: totalProblems,
      });
      await send({
        type: "question_start",
        index: caseSlot.startIndex + 1,
        total: totalProblems,
        track: caseSlot.track,
        topic: caseSlot.topic,
        topicLabel: TOPIC_LABELS[caseSlot.topic] ?? caseSlot.topic,
        difficulty: caseSlot.difficulty,
      });

      const result = await generateAndStoreStudyCase({
        userId: authResult.user.id,
        track: caseSlot.track,
        topic: caseSlot.topic,
        difficultyMode: session.meta.difficultyMode,
        difficulty: caseSlot.difficulty,
        problemCount: caseSlot.problemCount,
        focusPrompt: `Paket simulasi studi kasus hAIplay bagian ${caseIndex + 1} dari ${session.cases.length}. Buat tepat ${caseSlot.problemCount} soal terkait.`,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        modelId: settings.modelId,
        onProgress: send,
      });

      const problems = [...result.problems.slice(0, caseSlot.problemCount)];

      // Fill short packs with single hAIplay items so the mock still completes.
      while (problems.length < caseSlot.problemCount) {
        const fillIndex = caseSlot.startIndex + problems.length;
        const slot = session.slots[fillIndex]!;
        await send({
          type: "status",
          message: `Melengkapi studi kasus ${caseIndex + 1}: soal ${problems.length + 1}/${caseSlot.problemCount}…`,
          index: fillIndex + 1,
          total: totalProblems,
        });
        const filler = await generateSlotProblem({
          userId: authResult.user.id,
          slot,
          focusPrompt: `Lanjutkan studi kasus "${result.caseTitle}" (soal pelengkap, gaya hAIplay, text-only).`,
          difficultyMode: session.meta.difficultyMode,
          baseUrl: settings.baseUrl,
          apiKey: settings.apiKey,
          modelId: settings.modelId,
          progressIndex: fillIndex + 1,
          progressTotal: totalProblems,
          onProgress: send,
        });
        problems.push(filler);
      }

      setAiMockSessionProblems(
        planId,
        authResult.user.id,
        caseSlot.startIndex,
        problems.map((p) => p.id),
      );

      for (let i = 0; i < caseSlot.problemCount; i++) {
        const problem = problems[i]!;
        await send({
          type: "question_done",
          index: caseSlot.startIndex + i + 1,
          total: totalProblems,
          title: problem.title,
          topic: problem.topic,
          topicLabel: TOPIC_LABELS[problem.topic] ?? problem.topic,
        });
        await send({
          type: "slot_done",
          phase: "slot",
          planId,
          index: caseSlot.startIndex + i,
          problemId: problem.id,
          title: problem.title,
          topic: problem.topic,
          topicLabel: TOPIC_LABELS[problem.topic] ?? problem.topic,
          difficulty: problem.difficulty,
        });
      }
    });
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
    const durationMinutes = session.meta.durationMinutes ?? 30;
    const db = await getDb();
    await db.insert(generatedMocks).values({
      id,
      createdBy: authResult.user.id,
      title: session.meta.title,
      description: session.meta.description,
      durationMinutes,
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
        durationMinutes,
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

  const generationMode = parseGenerationMode(body.generationMode);
  if (generationMode === "study-case") {
    return Response.json(
      {
        error:
          "Mode studi kasus memerlukan alur plan → case → commit dari UI.",
      },
      { status: 400 },
    );
  }
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
    const size = parseAiMockSize(body.size);
    const { slots, meta } = buildAiMockPlan({
      generationMode,
      track: TRACKS[track] ? track : "B",
      difficultyMode,
      topicPrompt,
      preferredTopic,
      size,
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
        progressIndex: slot.index + 1,
        progressTotal: slots.length,
      });
      problemIds.push(problem.id);
      difficulties.push(problem.difficulty);
      usedTopics.add(problem.topic);
    }

    if (problemIds.length !== meta.questionCount) {
      throw new Error("Jumlah soal simulasi tidak lengkap");
    }

    const id = `aimock-${nanoid(10)}`;
    const db = await getDb();
    await db.insert(generatedMocks).values({
      id,
      createdBy: authResult.user.id,
      title: meta.title,
      description: meta.description,
      durationMinutes: meta.durationMinutes,
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
        durationMinutes: meta.durationMinutes,
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
