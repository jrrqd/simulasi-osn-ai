import { TOPIC_LABELS } from "@/lib/content/types";
import type { GenerationProgressEvent } from "@/lib/ai/generation-progress";
import {
  applyGenerationProgressEvent,
  INITIAL_GENERATION_PROGRESS,
  readGenerationNdjsonStream,
  type GenerationProgressState,
} from "@/components/generation-progress";
import {
  aiMockSizeMeta,
  isKaggleSize,
  type AiMockSize,
} from "@/lib/ai/ai-mock-plan";

export type AiMockPlanRequest = {
  generationMode: "standard" | "custom" | "study-case";
  track?: string;
  difficultyMode: string;
  topicPrompt?: string;
  size?: AiMockSize;
  /** IOAI year pack for kaggle-150 / kaggle-300. */
  ioaiYear?: number;
};

/**
 * Client-side plan → per-slot/case stream → commit flow for AI mock generation.
 * Shared by the quick (10), full (20/40), kaggle (3 · 150 min), and Final IOAI (5 · 5 jam) generators.
 */
export async function runAiMockGeneration(params: {
  request: AiMockPlanRequest;
  onProgress: (
    updater: (prev: GenerationProgressState) => GenerationProgressState,
  ) => void;
}): Promise<{ mockId: string }> {
  const { request, onProgress } = params;
  const isStudyCase = request.generationMode === "study-case";
  const sizeMeta = aiMockSizeMeta(request.size ?? "quick");
  const sizeLabel = String(sizeMeta.count);
  const sizeTotal = sizeMeta.count;
  const isKaggle = isKaggleSize(request.size ?? "quick");

  onProgress(() => ({
    ...INITIAL_GENERATION_PROGRESS,
    message: isStudyCase
      ? `Menyusun rencana studi kasus PREDIKSI (${sizeLabel} soal)…`
      : isKaggle
        ? `Menyusun rencana Kaggle style (${sizeLabel} coding · ${sizeMeta.durationMinutes} menit)…`
        : request.generationMode === "custom"
          ? `Menyusun rencana ${sizeLabel} soal dari brief topik…`
          : `Menyusun rencana ${sizeLabel} soal AI…`,
    phase: "planning",
    total: sizeTotal,
  }));

  const planRes = await fetch("/api/ai/generate-mock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phase: "plan",
      ...request,
    }),
  });
  const planData = await planRes.json();
  if (!planRes.ok) {
    if (planData.code === "SIMULASI_QUOTA_EXCEEDED") {
      throw new Error(
        planData.error ||
          "Kuota simulasi hari ini sudah habis. Pasang API key di Pengaturan atau coba lagi besok.",
      );
    }
    throw new Error(planData.error || "Gagal menyusun rencana simulasi");
  }

  const planId = String(planData.planId);
  const total = Number(planData.total) || 10;
  const planSlots = Array.isArray(planData.slots) ? planData.slots : [];
  const planCases = Array.isArray(planData.cases) ? planData.cases : [];
  const totalCases = Number(planData.totalCases) || planCases.length;

  if (isStudyCase) {
    onProgress((prev) => ({
      ...prev,
      total,
      phase: "generating",
      message: `Rencana siap · ${totalCases} studi kasus · ${total} soal…`,
    }));

    for (let caseIndex = 0; caseIndex < totalCases; caseIndex++) {
      const planned = planCases[caseIndex] as
        | {
            topic?: string;
            problemCount?: number;
            startIndex?: number;
          }
        | undefined;
      const topicLabel =
        (planned?.topic && (TOPIC_LABELS[planned.topic] ?? planned.topic)) ||
        "";
      const partCount = Number(planned?.problemCount) || 4;
      onProgress((prev) => ({
        ...prev,
        index: (planned?.startIndex ?? 0) + 1,
        total,
        topicLabel: topicLabel || prev.topicLabel,
        thinking: "",
        attempt: 0,
        phase: "generating",
        message: `Studi kasus ${caseIndex + 1}/${totalCases}${topicLabel ? `: ${topicLabel}` : ""} (${partCount} soal)…`,
      }));

      let lastError = "Gagal generate studi kasus";
      let ok = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        const caseRes = await fetch("/api/ai/generate-mock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase: "case",
            planId,
            caseIndex,
          }),
        });

        const contentType = caseRes.headers.get("content-type") ?? "";
        if (!contentType.includes("ndjson")) {
          const caseData = await caseRes.json().catch(() => ({}));
          lastError = (caseData as { error?: string }).error || lastError;
          continue;
        }

        try {
          await readGenerationNdjsonStream(
            caseRes,
            (event: GenerationProgressEvent) => {
              onProgress((prev) => applyGenerationProgressEvent(prev, event));
            },
          );
          ok = true;
        } catch (e) {
          lastError = e instanceof Error ? e.message : lastError;
        }
      }
      if (!ok) {
        throw new Error(
          `Studi kasus ${caseIndex + 1}/${totalCases}: ${lastError}`,
        );
      }
    }
  } else {
    onProgress((prev) => ({
      ...prev,
      total,
      phase: "generating",
      message:
        request.generationMode === "custom"
          ? `Rencana siap. LLM menulis soal 1/${total} sesuai brief…`
          : `Rencana siap. Menghasilkan soal 1/${total}…`,
    }));

    for (let index = 0; index < total; index++) {
      const planned = planSlots[index] as
        | { topic?: string; track?: string; difficulty?: number }
        | undefined;
      const topicLabel =
        (planned?.topic && (TOPIC_LABELS[planned.topic] ?? planned.topic)) ||
        "";
      onProgress((prev) => ({
        ...prev,
        index: index + 1,
        total,
        topicLabel: topicLabel || prev.topicLabel,
        thinking: "",
        attempt: 0,
        phase: "generating",
        message:
          request.generationMode === "custom"
            ? `LLM menulis soal ${index + 1}/${total}${topicLabel ? `: ${topicLabel}` : ""}…`
            : `Menghasilkan soal ${index + 1}/${total}${topicLabel ? `: ${topicLabel}` : ""}…`,
      }));

      let lastError = "Gagal generate soal";
      let ok = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        const slotRes = await fetch("/api/ai/generate-mock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase: "slot",
            planId,
            index,
          }),
        });

        const contentType = slotRes.headers.get("content-type") ?? "";
        if (!contentType.includes("ndjson")) {
          const slotData = await slotRes.json().catch(() => ({}));
          lastError = (slotData as { error?: string }).error || lastError;
          continue;
        }

        try {
          await readGenerationNdjsonStream(
            slotRes,
            (event: GenerationProgressEvent) => {
              onProgress((prev) => applyGenerationProgressEvent(prev, event));
            },
          );
          ok = true;
        } catch (e) {
          lastError = e instanceof Error ? e.message : lastError;
        }
      }
      if (!ok) {
        throw new Error(`Soal ${index + 1}/${total}: ${lastError}`);
      }
    }
  }

  onProgress((prev) => ({
    ...prev,
    phase: "saving",
    completedCount: total,
    message: "Menyimpan paket simulasi…",
    thinking: "",
  }));

  const commitRes = await fetch("/api/ai/generate-mock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phase: "commit",
      planId,
    }),
  });
  const commitData = await commitRes.json();
  if (!commitRes.ok) {
    throw new Error(commitData.error || "Gagal menyimpan simulasi");
  }

  return { mockId: String(commitData.mock.id) };
}
