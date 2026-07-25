"use client";

import { useEffect, useRef } from "react";
import type { GenerationProgressEvent } from "@/lib/ai/generation-progress";

export type GenerationProgressState = {
  message: string;
  index: number;
  total: number;
  topicLabel: string;
  phase: "idle" | "planning" | "generating" | "repairing" | "validating" | "saving";
  attempt: number;
  maxAttempts: number;
  thinking: string;
  completedCount: number;
  completedTitles: string[];
};

export const INITIAL_GENERATION_PROGRESS: GenerationProgressState = {
  message: "",
  index: 0,
  total: 10,
  topicLabel: "",
  phase: "idle",
  attempt: 0,
  maxAttempts: 3,
  thinking: "",
  completedCount: 0,
  completedTitles: [],
};

export function applyGenerationProgressEvent(
  prev: GenerationProgressState,
  event: GenerationProgressEvent,
): GenerationProgressState {
  switch (event.type) {
    case "status":
      return {
        ...prev,
        message: event.message,
        index: event.index ?? prev.index,
        total: event.total ?? prev.total,
        phase:
          event.message.toLowerCase().includes("menyimpan")
            ? "saving"
            : prev.phase === "idle"
              ? "generating"
              : prev.phase,
      };
    case "question_start":
      return {
        ...prev,
        index: event.index,
        total: event.total,
        topicLabel: event.topicLabel,
        thinking: "",
        attempt: 0,
        message: `Menulis soal ${event.index}/${event.total}: ${event.topicLabel}`,
        phase: "generating",
      };
    case "attempt": {
      const newAttempt =
        (event.phase === "generating" || event.phase === "repairing") &&
        event.attempt !== prev.attempt;
      return {
        ...prev,
        attempt: event.attempt,
        maxAttempts: event.maxAttempts,
        phase: event.phase,
        thinking: newAttempt ? "" : prev.thinking,
        message:
          event.phase === "repairing"
            ? `Memperbaiki JSON soal ${prev.index}/${prev.total} (percobaan ${event.attempt}/${event.maxAttempts})…`
            : event.phase === "validating"
              ? `Memvalidasi soal ${prev.index}/${prev.total}…`
              : `Model sedang menulis soal ${prev.index}/${prev.total}${
                  event.attempt > 1
                    ? ` (percobaan ${event.attempt}/${event.maxAttempts})`
                    : ""
                }…`,
      };
    }
    case "thinking":
      return {
        ...prev,
        thinking: event.text,
        phase: prev.phase === "idle" ? "generating" : prev.phase,
      };
    case "question_done":
      return {
        ...prev,
        index: event.index,
        total: event.total,
        topicLabel: event.topicLabel,
        thinking: "",
        message: `Selesai soal ${event.index}/${event.total}: ${event.title}`,
        completedCount: event.index,
        completedTitles: [...prev.completedTitles, event.title].slice(-5),
        phase: "generating",
      };
    case "slot_done":
      return {
        ...prev,
        thinking: "",
        completedCount: Math.max(prev.completedCount, event.index + 1),
        completedTitles: event.reused
          ? prev.completedTitles
          : prev.completedTitles.includes(event.title)
            ? prev.completedTitles
            : [...prev.completedTitles, event.title].slice(-5),
        message: event.reused
          ? `Soal ${event.index + 1} sudah siap (diambil ulang).`
          : `Selesai soal ${event.index + 1}: ${event.title}`,
        topicLabel: event.topicLabel,
        phase: "generating",
      };
    default:
      return prev;
  }
}

function phaseLabel(phase: GenerationProgressState["phase"]) {
  switch (phase) {
    case "planning":
      return "Menyusun rencana";
    case "repairing":
      return "Memperbaiki output";
    case "validating":
      return "Memvalidasi JSON";
    case "saving":
      return "Menyimpan paket";
    case "generating":
      return "Menulis soal";
    default:
      return "Menyiapkan";
  }
}

export function GenerationProgressPanel({
  state,
}: {
  state: GenerationProgressState;
}) {
  const thinkingRef = useRef<HTMLPreElement>(null);
  const completed =
    state.phase === "saving" ? state.total : state.completedCount;
  const pct =
    state.total > 0
      ? Math.min(100, Math.round((completed / state.total) * 100))
      : 0;

  useEffect(() => {
    const el = thinkingRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [state.thinking]);

  return (
    <div className="space-y-2 rounded-xl border border-[var(--line)] bg-white/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-[var(--ink)]">
          {phaseLabel(state.phase)}
          {state.index > 0
            ? ` · ${Math.min(state.index, state.total)}/${state.total}`
            : ""}
        </span>
        <span className="text-[var(--muted)]">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {state.message ? (
        <p className="text-xs text-[var(--muted)]">{state.message}</p>
      ) : null}
      {state.topicLabel ? (
        <p className="text-[11px] text-[var(--muted)]">
          Topik: {state.topicLabel}
          {state.attempt > 0
            ? ` · percobaan ${state.attempt}/${state.maxAttempts}`
            : ""}
        </p>
      ) : null}
      {state.thinking ? (
        <details open className="group rounded-lg bg-black/[0.03]">
          <summary className="cursor-pointer select-none px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted)]">
            Proses berpikir model
          </summary>
          <pre
            ref={thinkingRef}
            className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words px-2.5 pb-2 font-sans text-[11px] leading-relaxed text-[var(--ink)]/80"
          >
            {state.thinking}
          </pre>
        </details>
      ) : null}
      {state.completedTitles.length > 0 ? (
        <ul className="space-y-0.5 text-[11px] text-[var(--muted)]">
          {state.completedTitles.map((title, i) => (
            <li key={`${i}-${title}`} className="truncate">
              ✓ {title}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export async function readGenerationNdjsonStream(
  res: Response,
  onEvent: (event: GenerationProgressEvent) => void,
): Promise<Extract<GenerationProgressEvent, { type: "slot_done" }>> {
  if (!res.body) {
    throw new Error("Respons stream kosong");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneEvent: Extract<GenerationProgressEvent, { type: "slot_done" }> | null =
    null;

  const handleEvent = (event: GenerationProgressEvent) => {
    if (event.type === "error") {
      throw new Error(event.error || "Gagal generate soal");
    }
    onEvent(event);
    if (event.type === "slot_done") doneEvent = event;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let event: GenerationProgressEvent;
      try {
        event = JSON.parse(trimmed) as GenerationProgressEvent;
      } catch {
        continue;
      }
      handleEvent(event);
    }
  }

  const tail = buffer.trim();
  if (tail) {
    try {
      handleEvent(JSON.parse(tail) as GenerationProgressEvent);
    } catch (e) {
      if (e instanceof SyntaxError) {
        /* ignore trailing partial JSON */
      } else {
        throw e;
      }
    }
  }

  if (!doneEvent) {
    throw new Error("Generate soal selesai tanpa hasil");
  }
  return doneEvent;
}
