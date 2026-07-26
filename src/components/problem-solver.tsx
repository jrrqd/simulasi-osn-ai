"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { PythonRunner } from "@/components/python-runner";
import type { Problem } from "@/lib/content/types";
import { TOPIC_LABELS } from "@/lib/content/types";
import {
  difficultyBandTextClass,
  labelDifficultyBand,
} from "@/lib/ai/difficulty";

export function ProblemSolver({
  problem,
  reviewMode = false,
}: {
  problem: Problem;
  reviewMode?: boolean;
}) {
  const [answer, setAnswer] = useState("");
  const [started] = useState(() => Date.now());
  const [result, setResult] = useState<{
    correct: boolean;
    score: number;
    solution: string;
    expected: unknown;
    attemptId?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = !reviewMode;

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: problem.id,
          answer:
            problem.answerType === "mcq" || problem.answerType === "short_string"
              ? answer
              : answer,
          durationMs: Date.now() - started,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menilai");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
        <span className="rounded-full bg-white/70 px-3 py-1">
          Track {problem.track}
        </span>
        <span className="rounded-full bg-white/70 px-3 py-1">
          {TOPIC_LABELS[problem.topic] ?? problem.topic}
        </span>
        <span
          className={`rounded-full bg-white/70 px-3 py-1 font-semibold ${difficultyBandTextClass(problem.difficulty)}`}
        >
          {labelDifficultyBand(problem.difficulty)}
        </span>
        {problem.source === "ai" && (
          <span className="rounded-full bg-[rgba(196,92,38,0.15)] px-3 py-1 text-[var(--accent-2)]">
            AI-generated
          </span>
        )}
      </div>
      <h1 className="display text-3xl">{problem.title}</h1>
      <Markdown content={problem.stem} />

      {canSubmit && (
        <div className="panel space-y-3 rounded-3xl p-5">
          {problem.answerType === "mcq" && problem.choices ? (
            <div className="space-y-2">
              {problem.choices.map((c) => (
                <label
                  key={c}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/60 px-3 py-2"
                >
                  <input
                    type="radio"
                    name="mcq"
                    value={c}
                    checked={answer === c}
                    onChange={() => setAnswer(c)}
                  />
                  <span>{c}</span>
                </label>
              ))}
            </div>
          ) : (
            <input
              className="input"
              placeholder="Jawaban singkat / numerik"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          )}

          {(problem.answerType === "python_output" || problem.starterCode) && (
            <PythonRunner
              initialCode={problem.starterCode || "# tulis kode\nprint(0)"}
              onOutput={(out) => setAnswer(out)}
            />
          )}

          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={loading || !answer}
          >
            {loading ? "Menilai…" : "Kumpulkan jawaban"}
          </button>
          {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
        </div>
      )}

      {result && (
        <div className="panel space-y-4 rounded-3xl p-5">
          <p
            className={`text-lg font-semibold ${
              result.correct ? "text-[var(--ok)]" : "text-[var(--bad)]"
            }`}
          >
            {result.correct ? "Benar" : "Belum tepat"} · skor{" "}
            {(result.score * 100).toFixed(0)}%
          </p>
          <div>
            <h2 className="display mb-2 text-xl">Pembahasan</h2>
            <Markdown content={result.solution} />
          </div>
          <Link
            className="btn btn-accent"
            href={`/review/${problem.id}?attempt=${result.attemptId ?? ""}`}
          >
            Tanya Tutor AI
          </Link>
        </div>
      )}
    </div>
  );
}

export function useClientProblem(problem: Problem) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return useMemo(() => (mounted ? problem : problem), [mounted, problem]);
}
