"use client";

import { useEffect, useMemo, useState } from "react";
import { Countdown } from "@/components/countdown";
import { CompetitionWorkspace } from "@/components/competition-workspace";
import type { ExamFacingProblem } from "@/lib/content/exam-facing-problem";
import { defaultProblemWeight, TOPIC_LABELS } from "@/lib/content/types";
import { preloadPyodideDataScience } from "@/lib/pyodide-client";
import type { CompetitionRunResult } from "@/lib/scoring";
import type { ExamIntegrityMode } from "@/lib/exam-integrity-policy";
import { DEFAULT_PENALTY_MINUTES_PER_WRONG } from "@/lib/exam/penalty";

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

type Result = {
  score: number;
  maxScore: number;
  percentage: number;
  breakdown: Record<
    string,
    {
      score: number;
      weight: number;
      metricLabel?: string;
      metricValue?: number;
    }
  >;
};

export function KaggleMockClient({
  mockId,
  title,
  durationMinutes,
  problems,
  integrityMode = "off",
  penaltyEnabled: penaltyEnabledProp = true,
  penaltyMinutesPerWrong: penaltyPerWrongProp = DEFAULT_PENALTY_MINUTES_PER_WRONG,
}: {
  mockId: string;
  title: string;
  durationMinutes: number;
  problems: ExamFacingProblem[];
  integrityMode?: ExamIntegrityMode;
  penaltyEnabled?: boolean;
  penaltyMinutesPerWrong?: number;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [activeId, setActiveId] = useState(problems[0]?.id ?? "");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [scores, setScores] = useState<Record<string, CompetitionRunResult>>(
    {},
  );
  const [logsByProblem, setLogsByProblem] = useState<
    Record<string, LogEntry[]>
  >({});

  const totalWeight = useMemo(
    () => problems.reduce((s, p) => s + defaultProblemWeight(p), 0),
    [problems],
  );

  const earnedWeight = useMemo(() => {
    let sum = 0;
    for (const p of problems) {
      const w = defaultProblemWeight(p);
      const r = scores[p.id];
      if (r) sum += w * r.score;
    }
    return sum;
  }, [problems, scores]);

  useEffect(() => {
    if (!sessionId) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!result) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [result, sessionId]);

  async function start() {
    setStarting(true);
    setError("");
    const response = await fetch("/api/mocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mockId }),
    });
    const data = await response.json();
    setStarting(false);
    if (!response.ok) {
      setError(data.error || "Gagal memulai simulasi");
      return;
    }
    setSessionId(data.sessionId);
    setEndsAt(data.endsAt);
    preloadPyodideDataScience();

    // Restore prior competition answers/logs if any
    const answers = (data.answers ?? {}) as Record<string, unknown>;
    const restoredScores: Record<string, CompetitionRunResult> = {};
    for (const p of problems) {
      const a = answers[p.id];
      if (a && typeof a === "object" && "score" in (a as object)) {
        const row = a as CompetitionRunResult & { kind?: string };
        restoredScores[p.id] = {
          metricValue: Number(row.metricValue) || 0,
          score: Number(row.score) || 0,
          metricLabel: String(row.metricLabel || "Metric"),
          log: String(row.log || ""),
          summary: row.summary,
          rowCount: Number(row.rowCount) || 0,
          gradedBy: row.gradedBy,
        };
      }
    }
    setScores(restoredScores);
    const logs = (answers.__competitionLogs as Record<string, LogEntry[]>) ?? {};
    setLogsByProblem(logs);
  }

  async function finish() {
    if (!sessionId) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/mocks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          answers: {
            ...Object.fromEntries(
              Object.entries(scores).map(([id, r]) => [
                id,
                {
                  kind: "competition_submission",
                  ...r,
                },
              ]),
            ),
            __competitionLogs: logsByProblem,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mengumpulkan");

      setResult({
        score: Number(data.score) || 0,
        maxScore: Number(data.maxScore) || totalWeight,
        percentage: Number(data.percentage) || 0,
        breakdown: Object.fromEntries(
          problems.map((p) => {
            const b = data.breakdown?.[p.id];
            return [
              p.id,
              {
                score: Number(b?.score) || scores[p.id]?.score || 0,
                weight: Number(b?.weight) || defaultProblemWeight(p),
                metricLabel: scores[p.id]?.metricLabel,
                metricValue: scores[p.id]?.metricValue,
              },
            ];
          }),
        ),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <section className="panel mx-auto max-w-3xl space-y-5 rounded-3xl p-7">
        <h1 className="display text-4xl">{title}</h1>
        <p className="text-sm text-[var(--muted)]">Laporan kompetisi Kaggle-style</p>
        <p className="display text-5xl">
          {result.percentage.toFixed(1)}%
        </p>
        <p className="text-sm text-[var(--muted)]">
          {result.score.toFixed(2)} / {result.maxScore} poin
        </p>
        <ul className="space-y-2">
          {problems.map((p) => {
            const b = result.breakdown[p.id];
            return (
              <li
                key={p.id}
                className="rounded-2xl border border-[var(--line)] p-3 text-sm"
              >
                <p className="font-semibold">{p.title}</p>
                <p className="text-[var(--muted)]">
                  {b?.metricLabel ?? "—"}:{" "}
                  {typeof b?.metricValue === "number"
                    ? b.metricValue.toFixed(4)
                    : "belum submit"}{" "}
                  · {(b?.score ?? 0) * (b?.weight ?? 0)} / {b?.weight ?? 0} poin
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  if (!sessionId || !endsAt) {
    return (
      <section className="panel mx-auto max-w-3xl space-y-6 rounded-3xl p-7">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Simulasi Kaggle / IOAI
          </p>
          <h1 className="display text-4xl">{title}</h1>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--line)] p-3">
            <p className="text-xs text-[var(--muted)]">Kompetisi</p>
            <p className="font-semibold">{problems.length}</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] p-3">
            <p className="text-xs text-[var(--muted)]">Durasi</p>
            <p className="font-semibold">{durationMinutes} menit</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] p-3">
            <p className="text-xs text-[var(--muted)]">Skor maks</p>
            <p className="font-semibold">{totalWeight} poin</p>
          </div>
        </div>
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
          <li>
            Format kompetisi: Overview → Data → Notebook → Submit → Logs.
          </li>
          <li>
            Kerjakan di tab <strong>Notebook</strong> (Python + pandas di
            browser), lalu Submit <code>submission.csv</code>. Unduh{" "}
            <code>.ipynb</code> + CSV hanya jika ingin Jupyter / VS Code /
            Colab.
          </li>
          <li>
            Skor proporsional menurut metrik tiap kompetisi (accuracy, F1,
            RMSE/MAE).
          </li>
          {integrityMode === "off" ? (
            <li>
              Integritas: mode layar penuh browser tidak dipakai (sesuai aturan
              semifinal/final — proctor Zoom + rekam layar pada event resmi).
              Multi-tab / Jupyter diperbolehkan dalam latihan ini.
            </li>
          ) : null}
          {penaltyEnabledProp ? (
            <li>
              Submission penalty (opsional): salah submit dapat menambah penalti
              menit (+{penaltyPerWrongProp}).
            </li>
          ) : null}
        </ul>
        {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
        <button
          className="btn btn-primary w-full"
          onClick={() => void start()}
          disabled={starting}
        >
          {starting ? "Menyiapkan…" : `Mulai ${durationMinutes} menit`}
        </button>
      </section>
    );
  }

  const active = problems.find((p) => p.id === activeId) ?? problems[0]!;

  return (
    <div className="space-y-5">
      <div className="sticky top-[68px] z-30 rounded-2xl border border-[var(--line)] bg-[rgba(243,239,230,0.95)] p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              {title}
            </p>
            <p className="text-sm text-[var(--muted)]">
              Skor sementara {earnedWeight.toFixed(2)} / {totalWeight}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Countdown
              endsAt={endsAt}
              onExpire={() => {
                void finish();
              }}
            />
            <button
              type="button"
              className="btn btn-accent !px-3 !py-1.5 text-sm"
              disabled={submitting}
              onClick={() => void finish()}
            >
              {submitting ? "Mengirim…" : "Akhiri ujian"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-2">
          {problems.map((p, i) => {
            const s = scores[p.id];
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveId(p.id)}
                className={`w-full rounded-2xl border p-3 text-left text-sm ${
                  p.id === active.id
                    ? "border-[var(--accent)] bg-[rgba(56,120,90,0.08)]"
                    : "border-[var(--line)]"
                }`}
              >
                <p className="font-semibold">
                  {i + 1}. {p.title}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {TOPIC_LABELS[p.topic] ?? p.topic}
                  {s
                    ? ` · ${(s.score * 100).toFixed(0)}%`
                    : " · belum submit"}
                </p>
              </button>
            );
          })}
        </aside>

        <section className="panel rounded-3xl p-5">
          <CompetitionWorkspace
            key={active.id}
            problem={active}
            sessionId={sessionId}
            logs={logsByProblem[active.id] ?? []}
            onGraded={(r, logs) => {
              setScores((prev) => ({ ...prev, [active.id]: r }));
              setLogsByProblem((prev) => ({ ...prev, [active.id]: logs }));
            }}
          />
        </section>
      </div>
      {error ? <p className="text-sm text-[var(--bad)]">{error}</p> : null}
    </div>
  );
}
