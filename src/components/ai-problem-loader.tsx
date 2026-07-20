"use client";

import { useEffect, useState } from "react";
import { ProblemSolver } from "@/components/problem-solver";
import type { Problem } from "@/lib/content/types";

export function AiProblemLoader({ id }: { id: string }) {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const raw = sessionStorage.getItem(`problem:${id}`);
      if (raw) {
        try {
          if (!cancelled) setProblem(JSON.parse(raw));
          return;
        } catch {
          // fall through to API
        }
      }

      try {
        const res = await fetch(`/api/problems/${encodeURIComponent(id)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Soal tidak ditemukan");
        if (!cancelled) {
          setProblem(data.problem);
          sessionStorage.setItem(
            `problem:${id}`,
            JSON.stringify(data.problem),
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Soal AI tidak ditemukan.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <p className="text-[var(--bad)]">{error}</p>;
  if (!problem) return <p className="text-[var(--muted)]">Memuat soal AI…</p>;
  return <ProblemSolver problem={problem} />;
}
