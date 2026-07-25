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

type GenerationMode = "standard" | "custom";

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
  const [progress, setProgress] = useState("");

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
    setProgress(
      generationMode === "custom"
        ? "Menyusun rencana 10 soal dari brief topik…"
        : "Menyusun rencana 10 soal AI…",
    );
    try {
      const planRes = await fetch("/api/ai/generate-mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "plan",
          generationMode,
          track: generationMode === "standard" ? track : undefined,
          difficultyMode,
          topicPrompt:
            generationMode === "custom" ? topicPrompt.trim() : undefined,
        }),
      });
      const planData = await planRes.json();
      if (!planRes.ok) {
        throw new Error(planData.error || "Gagal menyusun rencana simulasi");
      }

      const planId = String(planData.planId);
      const total = Number(planData.total) || 10;

      for (let index = 0; index < total; index++) {
        setProgress(
          generationMode === "custom"
            ? `LLM menulis soal ${index + 1}/${total} sesuai brief topik…`
            : `Menghasilkan soal ${index + 1}/${total}…`,
        );

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
          const slotData = await slotRes.json();
          if (slotRes.ok && slotData.problemId) {
            ok = true;
            break;
          }
          lastError = slotData.error || lastError;
        }
        if (!ok) {
          throw new Error(`Soal ${index + 1}/${total}: ${lastError}`);
        }
      }

      setProgress("Menyimpan paket simulasi…");
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

      router.push(`/mock/${commitData.mock.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  return (
    <CollapsiblePanel
      title="Generate simulasi AI"
      summary="Buat 10 soal baru / 30 menit (batas 2× per jam)."
      accent="accent"
    >
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
      </div>

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
          : generationMode === "custom"
            ? "Generate dari brief topik"
            : "Buat simulasi AI"}
      </button>
      {progress && <p className="text-xs text-[var(--muted)]">{progress}</p>}
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
    </CollapsiblePanel>
  );
}
