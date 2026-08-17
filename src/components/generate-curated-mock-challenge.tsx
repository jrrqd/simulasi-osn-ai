"use client";

import { useState } from "react";
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
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { ChoiceChip } from "@/components/choice-chip";
import { PhaseHintBanner } from "@/components/phase-hint-banner";
import {
  formatQuotaError,
  SimulasiQuotaBanner,
  useSimulasiQuota,
} from "@/components/simulasi-quota-banner";

type GenerationMode = "standard" | "custom";

const TOPIC_HINTS = Object.entries(TOPIC_LABELS).map(([id, label]) => ({
  id,
  label,
}));

export function GenerateCuratedMockChallenge() {
  const router = useRouter();
  const { quota } = useSimulasiQuota();
  const [generationMode, setGenerationMode] =
    useState<GenerationMode>("standard");
  const [track, setTrack] = useState<"ALL" | "A" | "B" | "C" | "D">("ALL");
  const [difficultyMode, setDifficultyMode] =
    useState<DifficultyMode>("normal");
  const [size, setSize] = useState<CuratedMockSize>("full");
  const [topicPrompt, setTopicPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progressText, setProgressText] = useState("");

  const sizeMeta =
    CURATED_MOCK_SIZES.find((s) => s.value === size) ?? CURATED_MOCK_SIZES[1]!;
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

  async function generate() {
    setLoading(true);
    setError("");
    setProgressText(
      generationMode === "custom"
        ? "LLM sedang menyusun paket sesuai preferensi topik…"
        : "LLM sedang menyusun paket dari bank curated…",
    );
    try {
      const res = await fetch("/api/ai/generate-curated-mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationMode,
          track: generationMode === "custom" ? "ALL" : track,
          difficultyMode,
          size,
          topicPrompt:
            generationMode === "custom" ? topicPrompt.trim() : undefined,
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

  return (
    <CollapsiblePanel
      title="Susun simulasi curated"
      summary={`Memilih & mengurutkan ${sizeMeta.count} soal dari bank curated (${sizeMeta.durationMinutes} mnt) — bukan menulis soal baru.`}
      accent="primary"
    >
      <PhaseHintBanner />
      <SimulasiQuotaBanner quota={quota} />

      <div className="flex flex-wrap gap-2">
        <ChoiceChip
          active={generationMode === "standard"}
          onClick={() => setGenerationMode("standard")}
          disabled={loading}
        >
          Standar
        </ChoiceChip>
        <ChoiceChip
          active={generationMode === "custom"}
          onClick={() => setGenerationMode("custom")}
          disabled={loading}
        >
          Custom topik
        </ChoiceChip>
      </div>

      {generationMode === "custom" ? (
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
              onChange={(e) => setSize(e.target.value as CuratedMockSize)}
              disabled={loading}
            >
              {CURATED_MOCK_SIZES.map((s) => (
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
            onChange={(e) => setSize(e.target.value as CuratedMockSize)}
            disabled={loading}
          >
            {CURATED_MOCK_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={generate}
        disabled={loading || quotaExhausted}
      >
        {loading
          ? "Menyusun…"
          : generationMode === "custom"
            ? "Susun dari preferensi topik"
            : "Susun simulasi curated"}
      </button>
      {progressText ? (
        <p className="text-xs text-[var(--muted)]">{progressText}</p>
      ) : null}
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
    </CollapsiblePanel>
  );
}
