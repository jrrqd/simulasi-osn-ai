"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRACKS } from "@/lib/content/types";
import {
  DIFFICULTY_MODES,
  type DifficultyMode,
} from "@/lib/ai/difficulty";

export function GenerateMockChallenge() {
  const router = useRouter();
  const [track, setTrack] = useState<"A" | "B" | "C" | "D">("B");
  const [difficultyMode, setDifficultyMode] =
    useState<DifficultyMode>("normal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    setProgress("Menghasilkan 10 soal AI… ini bisa memakan beberapa menit.");
    try {
      const res = await fetch("/api/ai/generate-mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track, difficultyMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal generate simulasi");
      router.push(`/mock/${data.mock.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  return (
    <div className="panel space-y-3 rounded-3xl p-5">
      <h2 className="display text-2xl">Generate simulasi AI</h2>
      <p className="text-sm text-[var(--muted)]">
        Membuat 10 soal / 30 menit yang langsung masuk pool bersama. Batas 2
        simulasi per jam.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <select
          className="select"
          value={track}
          onChange={(e) => setTrack(e.target.value as "A" | "B" | "C" | "D")}
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
        >
          {DIFFICULTY_MODES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-accent" onClick={generate} disabled={loading}>
        {loading ? "Menghasilkan…" : "Buat simulasi AI"}
      </button>
      {progress && <p className="text-sm text-[var(--muted)]">{progress}</p>}
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
    </div>
  );
}
