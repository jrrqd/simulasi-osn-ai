"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRACKS, TOPIC_LABELS } from "@/lib/content/types";
import {
  DIFFICULTY_MODES,
  type DifficultyMode,
} from "@/lib/ai/difficulty";

export function GenerateChallenge() {
  const router = useRouter();
  const [track, setTrack] = useState<"A" | "B" | "C" | "D">("B");
  const [topic, setTopic] = useState(TRACKS.B.topics[0]);
  const [difficultyMode, setDifficultyMode] =
    useState<DifficultyMode>("medium");
  const [answerType, setAnswerType] = useState("numeric");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track, topic, difficultyMode, answerType }),
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
      <div className="grid gap-3 md:grid-cols-2">
        <select
          className="select"
          value={track}
          onChange={(e) => {
            const t = e.target.value as "A" | "B" | "C" | "D";
            setTrack(t);
            setTopic(TRACKS[t].topics[0]);
          }}
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
        >
          {["numeric", "short_string", "mcq", "python_output"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-accent" onClick={generate} disabled={loading}>
        {loading ? "Menghasilkan…" : "Buat soal baru"}
      </button>
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
    </div>
  );
}
