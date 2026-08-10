"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TOPIC_LABELS, TRACKS } from "@/lib/content/types";
import {
  DIFFICULTY_MODES,
  type DifficultyMode,
} from "@/lib/ai/difficulty";
import {
  CURATED_MOCK_SIZES,
  TOPIC_PROMPT_MAX_LEN,
  type CuratedMockSize,
} from "@/lib/ai/curated-mock-size";
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
import {
  formatQuotaError,
  SimulasiQuotaBanner,
  useSimulasiQuota,
} from "@/components/simulasi-quota-banner";

type GenerationMode = "standard" | "custom" | "study-case";
type SourceMode = "curated" | "ai";

const TOPIC_HINTS = Object.entries(TOPIC_LABELS).map(([id, label]) => ({
  id,
  label,
}));

export function GenerateCuratedMockChallenge() {
  const router = useRouter();
  const { quota } = useSimulasiQuota();
  const [sourceMode, setSourceMode] = useState<SourceMode>("curated");
  const [generationMode, setGenerationMode] =
    useState<GenerationMode>("standard");
  const [track, setTrack] = useState<"ALL" | "A" | "B" | "C" | "D">("ALL");
  const [difficultyMode, setDifficultyMode] =
    useState<DifficultyMode>("normal");
  const [size, setSize] = useState<AiMockSize>("full");
  const [topicPrompt, setTopicPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progressText, setProgressText] = useState("");
  const [progress, setProgress] = useState<GenerationProgressState>(
    INITIAL_GENERATION_PROGRESS,
  );

  const sizeOptions = useMemo(
    () => (sourceMode === "ai" ? AI_MOCK_SIZES : CURATED_MOCK_SIZES),
    [sourceMode],
  );

  const sizeMeta =
    sizeOptions.find((s) => s.value === size) ??
    (sourceMode === "ai" ? AI_MOCK_SIZES[0]! : CURATED_MOCK_SIZES[1]!);

  const isKaggle = isKaggleSize(size);
  const isKaggle150 = size === "kaggle-150";
  const effectiveMode: GenerationMode =
    isKaggle && generationMode === "study-case" ? "standard" : generationMode;
  const quotaExhausted =
    quota?.simulasi.gated === true &&
    quota.simulasi.remaining != null &&
    quota.simulasi.remaining <= 0;

  function appendTopicHint(label: string) {
    setTopicPrompt((prev) => {
      const next = prev.trim();
      if (!next) return label;
      if (next.toLowerCase().includes(label.toLowerCase())) return next;
      return `${next}, ${label}`;
    });
  }

  function switchSource(next: SourceMode) {
    setSourceMode(next);
    if (next === "curated") {
      if (generationMode === "study-case") setGenerationMode("standard");
      if (isKaggle || size === "quick") setSize("full");
    }
  }

  async function generateCurated() {
    setLoading(true);
    setError("");
    setProgressText(
      effectiveMode === "custom"
        ? "LLM sedang menyusun paket sesuai preferensi topik…"
        : "LLM sedang menyusun paket dari bank curated…",
    );
    try {
      const curatedSize: CuratedMockSize =
        size === "half" ? "half" : "full";
      const res = await fetch("/api/ai/generate-curated-mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationMode:
            effectiveMode === "study-case" ? "standard" : effectiveMode,
          track: effectiveMode === "custom" ? "ALL" : track,
          difficultyMode,
          size: curatedSize,
          topicPrompt:
            effectiveMode === "custom" ? topicPrompt.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatQuotaError(data));
      router.push(`/mock/${data.mock.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
      setProgressText("");
    }
  }

  async function generateAiFull() {
    setLoading(true);
    setError("");
    setProgress(INITIAL_GENERATION_PROGRESS);
    try {
      const { mockId } = await runAiMockGeneration({
        request: {
          generationMode: effectiveMode,
          track: effectiveMode === "custom" ? "ALL" : track,
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

  async function generate() {
    if (sourceMode === "ai") {
      await generateAiFull();
    } else {
      await generateCurated();
    }
  }

  return (
    <CollapsiblePanel
      title="Susun simulasi curated / AI penuh"
      summary={`Bank curated atau generate ${sizeMeta.count} soal AI baru (${sizeMeta.durationMinutes} mnt), termasuk Kaggle style (2–3 coding · 150/300 menit) dan studi kasus PREDIKSI.`}
      accent="primary"
    >
      <PhaseHintBanner />
      <SimulasiQuotaBanner quota={quota} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn !px-3 !py-1.5 text-sm ${sourceMode === "curated" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => switchSource("curated")}
          disabled={loading}
        >
          Bank curated
        </button>
        <button
          type="button"
          className={`btn !px-3 !py-1.5 text-sm ${sourceMode === "ai" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => switchSource("ai")}
          disabled={loading}
        >
          Generate AI penuh
        </button>
      </div>

      <p className="text-xs text-[var(--muted)]">
        {sourceMode === "curated"
          ? "Memilih & mengurutkan soal dari bank curated (bukan menulis soal baru)."
          : isKaggle
            ? isKaggle150
              ? "Format Kaggle style: LLM menulis 2 soal coding marathon · 150 menit."
              : "Format Kaggle style: LLM menulis 3 soal coding marathon · 300 menit."
            : effectiveMode === "study-case"
              ? `LLM menulis ${sizeMeta.count} soal sebagai paket studi kasus PREDIKSI terkait — progress ditampilkan di bawah.`
              : `LLM menulis ${sizeMeta.count} soal baru satu per satu — progress & thinking ditampilkan di bawah. Bisa memakan waktu lama.`}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn !px-3 !py-1.5 text-sm ${!isKaggle && effectiveMode === "standard" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => {
            setGenerationMode("standard");
            if (isKaggle) setSize("full");
          }}
          disabled={loading}
        >
          Standar
        </button>
        <button
          type="button"
          className={`btn !px-3 !py-1.5 text-sm ${!isKaggle && effectiveMode === "custom" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => {
            setGenerationMode("custom");
            if (isKaggle) setSize("full");
          }}
          disabled={loading}
        >
          Custom topik
        </button>
        {sourceMode === "ai" ? (
          <button
            type="button"
            className={`btn !px-3 !py-1.5 text-sm ${!isKaggle && generationMode === "study-case" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => {
              setGenerationMode("study-case");
              if (isKaggle) setSize("full");
            }}
            disabled={loading}
          >
            Studi kasus PREDIKSI
          </button>
        ) : null}
        {sourceMode === "ai" ? (
          <button
            type="button"
            className={`btn !px-3 !py-1.5 text-sm ${size === "kaggle-150" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => {
              setSize("kaggle-150");
              if (generationMode === "study-case") setGenerationMode("standard");
            }}
            disabled={loading}
          >
            Kaggle style · 150 menit
          </button>
        ) : null}
        {sourceMode === "ai" ? (
          <button
            type="button"
            className={`btn !px-3 !py-1.5 text-sm ${size === "kaggle" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => {
              setSize("kaggle");
              if (generationMode === "study-case") setGenerationMode("standard");
            }}
            disabled={loading}
          >
            Kaggle style · 5 jam
          </button>
        ) : null}
      </div>

      {effectiveMode === "custom" ? (
        <div className="space-y-2.5">
          <textarea
            className="textarea !min-h-[88px]"
            value={topicPrompt}
            onChange={(e) =>
              setTopicPrompt(e.target.value.slice(0, TOPIC_PROMPT_MAX_LEN))
            }
            placeholder="Contoh: Utamakan backpropagation, MLP, dan regularisasi…"
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
              {sizeOptions.map((s) => (
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
            onChange={(e) =>
              setTrack(e.target.value as "ALL" | "A" | "B" | "C" | "D")
            }
            disabled={loading}
          >
            <option value="ALL">Semua track (A–D)</option>
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
            {sizeOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        className="btn btn-primary !px-4 !py-2 text-sm"
        onClick={generate}
        disabled={loading || quotaExhausted}
      >
        {loading
          ? sourceMode === "ai"
            ? "Menghasilkan…"
            : "Menyusun…"
          : sourceMode === "ai"
            ? isKaggle
              ? isKaggle150
                ? "Generate simulasi Kaggle 150 menit"
                : "Generate simulasi Kaggle 5 jam"
              : effectiveMode === "study-case"
                ? `Generate ${sizeMeta.count} soal studi kasus`
                : `Generate ${sizeMeta.count} soal AI`
            : effectiveMode === "custom"
              ? "Susun dari preferensi topik"
              : "Susun simulasi curated"}
      </button>
      {sourceMode === "ai" && (loading || (error && progress.message)) ? (
        <GenerationProgressPanel state={progress} />
      ) : null}
      {sourceMode === "curated" && progressText ? (
        <p className="text-xs text-[var(--muted)]">{progressText}</p>
      ) : null}
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
    </CollapsiblePanel>
  );
}
