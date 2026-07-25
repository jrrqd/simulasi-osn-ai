import { TOPIC_LABELS } from "@/lib/content/types";
import type { GenerationProgressEvent } from "@/lib/ai/generation-progress";
import {
  applyGenerationProgressEvent,
  INITIAL_GENERATION_PROGRESS,
  readGenerationNdjsonStream,
  type GenerationProgressState,
} from "@/components/generation-progress";

export type AiMockPlanRequest = {
  generationMode: "standard" | "custom";
  track?: string;
  difficultyMode: string;
  topicPrompt?: string;
  size?: "quick" | "half" | "full";
};

/**
 * Client-side plan → per-slot stream → commit flow for AI mock generation.
 * Shared by the quick (10) and full (20/40) generators.
 */
export async function runAiMockGeneration(params: {
  request: AiMockPlanRequest;
  onProgress: (
    updater: (prev: GenerationProgressState) => GenerationProgressState,
  ) => void;
}): Promise<{ mockId: string }> {
  const { request, onProgress } = params;
  const sizeLabel =
    request.size === "full"
      ? "40"
      : request.size === "half"
        ? "20"
        : "10";

  onProgress(() => ({
    ...INITIAL_GENERATION_PROGRESS,
    message:
      request.generationMode === "custom"
        ? `Menyusun rencana ${sizeLabel} soal dari brief topik…`
        : `Menyusun rencana ${sizeLabel} soal AI…`,
    phase: "planning",
    total:
      request.size === "full" ? 40 : request.size === "half" ? 20 : 10,
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
    throw new Error(planData.error || "Gagal menyusun rencana simulasi");
  }

  const planId = String(planData.planId);
  const total = Number(planData.total) || 10;
  const planSlots = Array.isArray(planData.slots) ? planData.slots : [];

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
      (planned?.topic && (TOPIC_LABELS[planned.topic] ?? planned.topic)) || "";
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
