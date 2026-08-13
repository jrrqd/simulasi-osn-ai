"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TOPIC_LABELS, TRACKS } from "@/lib/content/types";
import {
  DIFFICULTY_MODES,
  type DifficultyMode,
} from "@/lib/ai/difficulty";
import { TOPIC_PROMPT_MAX_LEN } from "@/lib/ai/curated-mock-size";
import {
  AI_MOCK_SIZES,
  isFinalKaggleSize,
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
  SimulasiQuotaBanner,
  useSimulasiQuota,
} from "@/components/simulasi-quota-banner";
import { parsePhase } from "@/lib/user/phase";

type GenerationMode = "standard" | "custom" | "study-case";

const TOPIC_HINTS = Object.entries(TOPIC_LABELS).map(([id, label]) => ({
  id,
  label,
}));

/** Prefer canonical size keys in the dropdown (hide legacy `kaggle` alias). */
const SIZE_OPTIONS = AI_MOCK_SIZES.filter((s) => s.value !== "kaggle");

export function GenerateMockChallenge() {
  const router = useRouter();
  const { quota } = useSimulasiQuota();
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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const phase = parsePhase(data.phase);
        if (phase === "final") setDifficultyMode("final");
        else if (phase === "semifinal") setDifficultyMode("semifinal");
      })
      .catch(() => {
        /* optional default */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sizeMeta =
    AI_MOCK_SIZES.find((s) => s.value === size) ?? AI_MOCK_SIZES[0]!;
  const isKaggle = isKaggleSize(size);
  const isFinalKaggle = isFinalKaggleSize(size);
  const effectiveMode: GenerationMode =
    isKaggle && generationMode === "study-case" ? "standard" : generationMode;
  const quotaExhausted =
    quota?.simulasi.gated === true &&
    quota.simulasi.remaining != null &&
    quota.simulasi.remaining <= 0;

  function applySize(next: AiMockSize) {
    setSize(next);
    if (isFinalKaggleSize(next)) {
      setDifficultyMode("final");
    }
    if (isKaggleSize(next) && generationMode === "study-case") {
      setGenerationMode("standard");
    }
  }

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
          track: effectiveMode === "custom" ? undefined : track,
          difficultyMode: isFinalKaggle ? "final" : difficultyMode,
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
      summary={`Buat ${sizeMeta.count} soal / ${sizeMeta.durationMinutes} menit (batas 2× per jam). Mode studi kasus PREDIKSI mengelompokkan soal terkait. Kaggle: 3 kompetisi · 150 menit, atau Final IOAI: 5 kompetisi · 5 jam.`}
      accent="accent"
    >
      <PhaseHintBanner />
      <SimulasiQuotaBanner quota={quota} />
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
          onClick={() => applySize("kaggle-150")}
          disabled={loading}
        >
          Kaggle style · 3 kompetisi · 150 menit
        </button>
        <button
          type="button"
          className={`btn !px-3 !py-1.5 text-sm ${size === "kaggle-300" ? "btn-accent" : "btn-secondary"}`}
          onClick={() => applySize("kaggle-300")}
          disabled={loading}
        >
          Final IOAI · 5 kompetisi · 5 jam
        </button>
      </div>

      {isFinalKaggle ? (
        <p className="text-xs text-[var(--muted)]">
          Marathon Final IOAI: 5 kompetisi notebook · 5 jam (300 menit), satu
          kompetisi per pilar silabus IOAI (Python, ML, CV, NLP, etika/data).
          Kesulitan otomatis Final (IOAI). Kerjakan di tab Notebook, Submit CSV.
        </p>
      ) : isKaggle ? (
        <p className="text-xs text-[var(--muted)]">
          Format Kaggle/IOAI: 3 kompetisi notebook · 150 menit. Kerjakan di tab
          Notebook (Python + pandas di browser), Submit CSV. Unduh .ipynb
          opsional. Referensi arsip IOAI dipakai saat generate. Studi kasus
          PREDIKSI tidak tersedia untuk ukuran ini.
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
              disabled={loading || isFinalKaggle}
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
              onChange={(e) => applySize(e.target.value as AiMockSize)}
              disabled={loading}
            >
              {SIZE_OPTIONS.map((s) => (
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
            disabled={loading || isKaggle}
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
            disabled={loading || isFinalKaggle}
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
            onChange={(e) => applySize(e.target.value as AiMockSize)}
            disabled={loading}
          >
            {SIZE_OPTIONS.map((s) => (
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
        disabled={loading || quotaExhausted}
      >
        {loading
          ? "Membuat…"
          : `Generate ${sizeMeta.count} soal / ${sizeMeta.durationMinutes} mnt`}
      </button>
      {error ? <p className="text-sm text-[var(--bad)]">{error}</p> : null}
      {loading ? <GenerationProgressPanel state={progress} /> : null}
    </CollapsiblePanel>
  );
}
