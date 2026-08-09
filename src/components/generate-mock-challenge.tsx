"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TOPIC_LABELS, TRACKS } from "@/lib/content/types";
import {
  DIFFICULTY_MODES,
  type DifficultyMode,
} from "@/lib/ai/difficulty";
import { TOPIC_PROMPT_MAX_LEN } from "@/lib/ai/curated-mock-size";
import {
  AI_MOCK_SIZES,
  isKaggleSize,
  type AiMockSize,
} from "@/lib/ai/ai-mock-plan";
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
  const [size, setSize] = useState<AiMockSize>("quick");
  const [topicPrompt, setTopicPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<GenerationProgressState>(
    INITIAL_GENERATION_PROGRESS,
  );

  const sizeMeta =
    AI_MOCK_SIZES.find((s) => s.value === size) ?? AI_MOCK_SIZES[0]!;
  const isKaggle = isKaggleSize(size);
  const isKaggle150 = size === "kaggle-150";
  const effectiveMode: GenerationMode =
    isKaggle && generationMode === "study-case" ? "standard" : generationMode;

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
          generationMode: effectiveMode,
          track:
            effectiveMode === "custom"
              ? undefined
              : track,
          difficultyMode,
          size,
          topicPrompt:
            effectiveMode === "custom" ? topicPrompt.trim() : undefined,
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
      summary={`Buat ${sizeMeta.count} soal / ${sizeMeta.durationMinutes} menit (batas 2× per jam). Mode studi kasus PREDIKSI mengelompokkan soal terkait. Pilih Kaggle style untuk 2 atau 3 coding marathon (150 / 300 menit).`}
      accent="accent"
    >
      <PhaseHintBanner />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn !px-3 !py-1.5 text-sm ${!isKaggle && effectiveMode === "standard" ? "btn-accent" : "btn-secondary"}`}
          onClick={() => {
            setGenerationMode("standard");
            if (isKaggle) setSize("quick");
          }}
          disabled={loading}
        >
          Standar
        </button>
        <button
          type="button"
          className={`btn !px-3 !py-1.5 text-sm ${!isKaggle && effectiveMode === "custom" ? "btn-accent" : "btn-secondary"}`}
          onClick={() => {
            setGenerationMode("custom");
            if (isKaggle) setSize("quick");
          }}
          disabled={loading}
        >
          Custom topik
        </button>
        <button
          type="button"
          className={`btn !px-3 !py-1.5 text-sm ${!isKaggle && generationMode === "study-case" ? "btn-accent" : "btn-secondary"}`}
          onClick={() => {
            setGenerationMode("study-case");
            if (isKaggle) setSize("quick");
          }}
          disabled={loading}
        >
          Studi kasus PREDIKSI
        </button>
        <button
          type="button"
          className={`btn !px-3 !py-1.5 text-sm ${size === "kaggle-150" ? "btn-accent" : "btn-secondary"}`}
          onClick={() => {
            setSize("kaggle-150");
            if (generationMode === "study-case") setGenerationMode("standard");
          }}
          disabled={loading}
        >
          Kaggle style · 150 menit
        </button>
        <button
          type="button"
          className={`btn !px-3 !py-1.5 text-sm ${size === "kaggle" ? "btn-accent" : "btn-secondary"}`}
          onClick={() => {
            setSize("kaggle");
            if (generationMode === "study-case") setGenerationMode("standard");
          }}
          disabled={loading}
        >
          Kaggle style · 5 jam
        </button>
      </div>

      {isKaggle ? (
        <p className="text-xs text-[var(--muted)]">
          {isKaggle150
            ? "Format Kaggle style: 2 soal coding panjang · 150 menit. Studi kasus PREDIKSI tidak tersedia untuk ukuran ini."
            : "Format Kaggle style: 3 soal coding panjang · 300 menit. Studi kasus PREDIKSI tidak tersedia untuk ukuran ini."}
        </p>
      ) : effectiveMode === "study-case" ? (
        <p className="text-xs text-[var(--muted)]">
          Soal disusun dari beberapa studi kasus terkait (text-only, gaya
          PREDIKSI).
        </p>
      ) : null}

      {effectiveMode === "custom" ? (
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
          <div className="grid gap-2 sm:grid-cols-2">
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
            <select
              className="select"
              value={size}
              onChange={(e) => {
                const next = e.target.value as AiMockSize;
                setSize(next);
                if (isKaggleSize(next) && generationMode === "study-case") {
                  setGenerationMode("standard");
                }
              }}
              disabled={loading}
            >
              {AI_MOCK_SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
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
          <select
            className="select"
            value={size}
            onChange={(e) => {
              const next = e.target.value as AiMockSize;
              setSize(next);
              if (isKaggleSize(next) && generationMode === "study-case") {
                setGenerationMode("standard");
              }
            }}
            disabled={loading}
          >
            {AI_MOCK_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
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
          : isKaggle
            ? isKaggle150
              ? "Buat simulasi Kaggle 150 menit"
              : "Buat simulasi Kaggle 5 jam"
            : effectiveMode === "study-case"
              ? "Buat simulasi studi kasus"
              : effectiveMode === "custom"
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
