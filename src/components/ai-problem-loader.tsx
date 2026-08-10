"use client";

import { useEffect, useState } from "react";
import { ProblemSolver } from "@/components/problem-solver";
import type { ExamFacingProblem } from "@/lib/content/exam-facing-problem";
import { problemCacheKey } from "@/lib/content/problem-cache";

export function AiProblemLoader({ id }: { id: string }) {
  const [problem, setProblem] = useState<ExamFacingProblem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cacheKey = problemCacheKey(id);
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        try {
          if (!cancelled) setProblem(JSON.parse(raw));
          return;
        } catch {
          sessionStorage.removeItem(cacheKey);
        }
      }

      try {
        const res = await fetch(`/api/problems/${encodeURIComponent(id)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Soal tidak ditemukan");
        if (!cancelled) {
          setProblem(data.problem);
          sessionStorage.setItem(cacheKey, JSON.stringify(data.problem));
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
