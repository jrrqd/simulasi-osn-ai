"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRACKS } from "@/lib/content/types";
import {
  DIFFICULTY_MODES,
  type DifficultyMode,
} from "@/lib/ai/difficulty";
import {
  CURATED_MOCK_SIZES,
  type CuratedMockSize,
} from "@/lib/ai/curated-mock-size";

export function GenerateCuratedMockChallenge() {
  const router = useRouter();
  const [track, setTrack] = useState<"ALL" | "A" | "B" | "C" | "D">("ALL");
  const [difficultyMode, setDifficultyMode] =
    useState<DifficultyMode>("normal");
  const [size, setSize] = useState<CuratedMockSize>("full");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    setProgress(
      "LLM sedang menyusun paket dari bank curated… biasanya cepat (detik–menit).",
    );
    try {
      const res = await fetch("/api/ai/generate-curated-mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track, difficultyMode, size }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyusun simulasi");
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
      <h2 className="display text-2xl">Susun simulasi curated dengan AI</h2>
      <p className="text-sm text-[var(--muted)]">
        LLM memilih dan mengurutkan soal dari bank curated resmi (bukan soal AI
        baru), lalu menyimpan paket bersama. Cocok untuk latihan format
        seleksi.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <select
          className="select"
          value={track}
          onChange={(e) =>
            setTrack(e.target.value as "ALL" | "A" | "B" | "C" | "D")
          }
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
        >
          {CURATED_MOCK_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-primary" onClick={generate} disabled={loading}>
        {loading ? "Menyusun…" : "Susun simulasi curated"}
      </button>
      {progress && <p className="text-sm text-[var(--muted)]">{progress}</p>}
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
    </div>
  );
}
