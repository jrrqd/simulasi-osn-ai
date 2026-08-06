"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TOPIC_LABELS, TRACKS } from "@/lib/content/types";
import {
  DIFFICULTY_MODES,
  type DifficultyMode,
} from "@/lib/ai/difficulty";
import { TOPIC_PROMPT_MAX_LEN } from "@/lib/ai/curated-mock-size";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import {
  INITIAL_GENERATION_PROGRESS,
  GenerationProgressPanel,
  type GenerationProgressState,
} from "@/components/generation-progress";
import { runAiMockGeneration } from "@/components/run-ai-mock-generation";
import { PhaseHintBanner } from "@/components/phase-hint-banner";

type GenerationMode = "standard" | "custom" | "study-case";

const TOPIC_HINTS = Object.entries(TOPIC_LABELS).map(([id, label]) => ({
  id,
  label,
}));

export function GenerateMockChallenge() {
  const router = useRouter();
  const [generationMode, setGenerationMode] =
    useState<GenerationMode>("standard");
  const [track, setTrack] = useState<"A" | "B" | "C" | "D">("B");
  const [difficultyMode, setDifficultyMode] =
    useState<DifficultyMode>("normal");
  const [topicPrompt, setTopicPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<GenerationProgressState>(
    INITIAL_GENERATION_PROGRESS,
  );

  function appendTopicHint(label: string) {
    setTopicPrompt((prev) => {
      const next = prev.trim();
      if (!next) return label;
      if (next.toLowerCase().includes(label.toLowerCase())) return next;
      return `${next}, ${label}`;
    });
  }

  async function generate() {
    setLoading(true);
    setError("");
    setProgress(INITIAL_GENERATION_PROGRESS);
    try {
      const { mockId } = await runAiMockGeneration({
        request: {
          generationMode,
          track:
            generationMode === "custom"
              ? undefined
              : track,
          difficultyMode,
          size: "quick",
          topicPrompt:
            generationMode === "custom" ? topicPrompt.trim() : undefined,
        },
        onProgress: setProgress,
      });
      router.push(`/mock/${mockId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CollapsiblePanel
      title="Generate simulasi AI"
      summary="Buat 10 soal baru / 30 menit (batas 2× per jam). Mode studi kasus PREDIKSI mengelompokkan soal terkait. Untuk 20/40 soal, pakai Generate AI penuh di panel atas."
      accent="accent"
    >
      <PhaseHintBanner />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn !px-3 !py-1.5 text-sm ${generationMode === "standard" ? "btn-accent" : "btn-secondary"}`}
          onClick={() => setGenerationMode("standard")}
          disabled={loading}
        >
          Standar
        </button>
        <button
          type="button"
          className={`btn !px-3 !py-1.5 text-sm ${generationMode === "custom" ? "btn-accent" : "btn-secondary"}`}
          onClick={() => setGenerationMode("custom")}
          disabled={loading}
        >
          Custom topik
        </button>
        <button
          type="button"
          className={`btn !px-3 !py-1.5 text-sm ${generationMode === "study-case" ? "btn-accent" : "btn-secondary"}`}
          onClick={() => setGenerationMode("study-case")}
          disabled={loading}
        >
          Studi kasus PREDIKSI
        </button>
      </div>

      {generationMode === "study-case" ? (
        <p className="text-xs text-[var(--muted)]">
          10 soal disusun dari beberapa studi kasus terkait (text-only, gaya
          PREDIKSI).
        </p>
      ) : null}

      {generationMode === "custom" ? (
        <div className="space-y-2.5">
          <textarea
            className="textarea !min-h-[88px]"
            value={topicPrompt}
            onChange={(e) =>
              setTopicPrompt(e.target.value.slice(0, TOPIC_PROMPT_MAX_LEN))
            }
            placeholder="Contoh: Fokus backpropagation & aktivasi/loss; sedikit MLP…"
            disabled={loading}
            rows={3}
          />
          <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
            {TOPIC_HINTS.map((t) => (
              <button
                key={t.id}
                type="button"
                className="btn btn-secondary !px-2.5 !py-1 text-xs"
                onClick={() => appendTopicHint(t.label)}
                disabled={loading}
              >
                {t.label}
              </button>
            ))}
          </div>
          <select
            className="select"
            value={difficultyMode}
            onChange={(e) =>
              setDifficultyMode(e.target.value as DifficultyMode)
            }
            disabled={loading}
          >
            {DIFFICULTY_MODES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="select"
            value={track}
            onChange={(e) => setTrack(e.target.value as "A" | "B" | "C" | "D")}
            disabled={loading}
          >
            {Object.entries(TRACKS).map(([id, meta]) => (
              <option key={id} value={id}>
                {id}. {meta.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={difficultyMode}
            onChange={(e) =>
              setDifficultyMode(e.target.value as DifficultyMode)
            }
            disabled={loading}
          >
            {DIFFICULTY_MODES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        className="btn btn-accent !px-4 !py-2 text-sm"
        onClick={generate}
        disabled={loading}
      >
        {loading
          ? "Menghasilkan…"
          : generationMode === "study-case"
            ? "Buat simulasi studi kasus"
            : generationMode === "custom"
              ? "Generate dari brief topik"
              : "Buat simulasi AI"}
      </button>
      {loading || (error && progress.message) ? (
        <GenerationProgressPanel state={progress} />
      ) : null}
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
    </CollapsiblePanel>
  );
}
