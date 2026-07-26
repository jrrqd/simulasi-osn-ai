"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRACKS, TOPIC_LABELS } from "@/lib/content/types";
import {
  DIFFICULTY_MODES,
  type DifficultyMode,
} from "@/lib/ai/difficulty";
import { TOPIC_PROMPT_MAX_LEN } from "@/lib/ai/curated-mock-size";

type GenerationMode = "standard" | "custom";

const TOPIC_HINTS = Object.entries(TOPIC_LABELS).map(([id, label]) => ({
  id,
  label,
}));

export function GenerateChallenge() {
  const router = useRouter();
  const [generationMode, setGenerationMode] =
    useState<GenerationMode>("standard");
  const [track, setTrack] = useState<"A" | "B" | "C" | "D">("B");
  const [topic, setTopic] = useState(TRACKS.B.topics[0]);
  const [topicPrompt, setTopicPrompt] = useState("");
  const [difficultyMode, setDifficultyMode] =
    useState<DifficultyMode>("medium");
  const [answerType, setAnswerType] = useState("numeric");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationMode,
          track: generationMode === "standard" ? track : undefined,
          topic: generationMode === "standard" ? topic : undefined,
          topicPrompt:
            generationMode === "custom" ? topicPrompt.trim() : undefined,
          difficultyMode,
          answerType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal generate");
      sessionStorage.setItem(
        `problem:${data.problem.id}`,
        JSON.stringify(data.problem),
      );
      router.push(`/practice/${data.problem.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel space-y-3 rounded-3xl p-5">
      <h2 className="display text-2xl">Generate tantangan AI</h2>
      <p className="text-sm text-[var(--muted)]">
        Soal masuk bank AI bersama dan bisa dikerjakan siswa lain. Menggunakan
        BYOK milikmu jika ada, atau LLM bersama dari admin.
      </p>

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
          <div className="grid gap-3 md:grid-cols-2">
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
              value={answerType}
              onChange={(e) => setAnswerType(e.target.value)}
              disabled={loading}
            >
              {["numeric", "short_string", "mcq", "python_output"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <select
            className="select"
            value={track}
            onChange={(e) => {
              const t = e.target.value as "A" | "B" | "C" | "D";
              setTrack(t);
              setTopic(TRACKS[t].topics[0]);
            }}
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
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
          >
            {TRACKS[track].topics.map((t) => (
              <option key={t} value={t}>
                {TOPIC_LABELS[t] ?? t}
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
            value={answerType}
            onChange={(e) => setAnswerType(e.target.value)}
            disabled={loading}
          >
            {["numeric", "short_string", "mcq", "python_output"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}

      <button className="btn btn-accent" onClick={generate} disabled={loading}>
        {loading
          ? "Menghasilkan…"
          : generationMode === "custom"
            ? "Generate dari brief topik"
            : "Buat soal baru"}
      </button>
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
    </div>
  );
}
