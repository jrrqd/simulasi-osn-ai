"use client";

import { useEffect, useState } from "react";
import { Markdown } from "@/components/markdown";
import { ReviewChat } from "@/components/review-chat";
import type { ExamFacingProblem } from "@/lib/content/exam-facing-problem";
import { problemCacheKey } from "@/lib/content/problem-cache";

export function ReviewAiFallback({ id }: { id: string }) {
  const [problem, setProblem] = useState<ExamFacingProblem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const raw = sessionStorage.getItem(problemCacheKey(id));
      if (raw) {
        try {
          if (!cancelled) setProblem(JSON.parse(raw));
          return;
        } catch {
          // fall through
        }
      }
      try {
        const res = await fetch(`/api/problems/${encodeURIComponent(id)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Soal tidak ditemukan");
        if (!cancelled) setProblem(data.problem);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Soal tidak ditemukan.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <p className="text-[var(--bad)]">{error}</p>;
  if (!problem) {
    return <p className="text-[var(--muted)]">Memuat soal…</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h1 className="display text-3xl">Review · {problem.title}</h1>
        <div className="panel rounded-3xl p-5">
          <Markdown content={problem.stem} />
        </div>
        <div className="panel rounded-3xl p-5">
          <p className="text-sm text-[var(--muted)]">
            Pembahasan tersedia dari hasil pengumpulan jawaban.
          </p>
        </div>
      </div>
      <ReviewChat problemId={problem.id} />
    </div>
  );
}
