"use client";

import { useState } from "react";
import Link from "next/link";
import { CompetitionWorkspace } from "@/components/competition-workspace";
import { Markdown } from "@/components/markdown";
import type { ExamFacingProblem } from "@/lib/content/exam-facing-problem";
import type { CompetitionRunResult } from "@/lib/scoring";

type LogEntry = {
  metricValue?: number;
  score?: number;
  metricLabel?: string;
  log?: string;
  summary?: string;
  rowCount?: number;
  gradedBy?: string;
  at?: string;
};

/**
 * Untimed Kaggle-style Latihan: CompetitionWorkspace + pembahasan after submit.
 */
export function PracticeCompetitionClient({
  problem,
}: {
  problem: ExamFacingProblem;
}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastResult, setLastResult] = useState<CompetitionRunResult | null>(
    null,
  );
  const [solution, setSolution] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Latihan · tanpa batas waktu
          </p>
          <p className="text-sm text-[var(--muted)]">
            Submit CSV untuk dinilai. Pembahasan terbuka setelah submit.
          </p>
        </div>
        <Link href="/practice" className="btn btn-secondary !px-3 !py-1.5 text-sm">
          Kembali ke Latihan
        </Link>
      </div>

      <CompetitionWorkspace
        problem={problem}
        sessionId="practice"
        mode="practice"
        logs={logs}
        onGraded={(result, nextLogs, meta) => {
          setLastResult(result);
          setLogs(nextLogs);
          if (meta?.solution) setSolution(meta.solution);
          if (meta?.attemptId) setAttemptId(meta.attemptId);
        }}
      />

      {lastResult ? (
        <section className="panel space-y-3 rounded-3xl p-5">
          <h2 className="display text-xl">Hasil submit</h2>
          <p className="text-sm">
            {lastResult.metricLabel}:{" "}
            <strong>{lastResult.metricValue.toFixed(4)}</strong> · skor{" "}
            <strong>{(lastResult.score * 100).toFixed(1)}%</strong>
          </p>
          {lastResult.log ? (
            <p className="text-xs text-[var(--muted)]">{lastResult.log}</p>
          ) : null}
          {attemptId ? (
            <Link
              href={`/review/${problem.id}?attempt=${attemptId}`}
              className="btn btn-secondary !px-3 !py-1.5 text-sm"
            >
              Buka review + Tutor AI
            </Link>
          ) : null}
        </section>
      ) : null}

      {solution ? (
        <section className="panel space-y-3 rounded-3xl p-5">
          <h2 className="display text-xl">Pembahasan</h2>
          <div className="prose-exam">
            <Markdown content={solution} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
