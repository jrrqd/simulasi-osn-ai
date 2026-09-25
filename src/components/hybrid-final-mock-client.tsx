"use client";

import { appPath } from "@/lib/app-path";
import { useEffect, useMemo, useState } from "react";
import { Countdown } from "@/components/countdown";
import { Markdown } from "@/components/markdown";
import { CodeRunner } from "@/components/code-runner";
import { CompetitionWorkspace } from "@/components/competition-workspace";
import type { ExamFacingProblem } from "@/lib/content/exam-facing-problem";
import { defaultProblemWeight, TOPIC_LABELS } from "@/lib/content/types";
import { needsCodeSpecRunner } from "@/lib/ai/exam-python-policy";
import { preloadPyodideDataScience } from "@/lib/pyodide-client";
import type { CompetitionRunResult } from "@/lib/scoring";
import type { CodeSpecRunResult } from "@/lib/scoring/index";
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
      weightedScore?: number;
      metricLabel?: string;
      metricValue?: number;
      passedCount?: number;
      totalCount?: number;
      isCoding?: boolean;
    }
  >;
};

function isNotebookProblem(problem: ExamFacingProblem) {
  return (
    problem.answerType === "notebook_submission" ||
    Boolean(problem.competitionSpec)
  );
}

/**
 * Final EKKA Day 2 exam UI: tabbed workspace mixing codeSpec runners and
 * notebook competitions. Reuses /api/mocks session lifecycle + scoring.
 */
export function HybridFinalMockClient({
  mockId,
  title,
  description,
  durationMinutes,
  problems,
  integrityMode = "off",
  penaltyEnabled: penaltyEnabledProp = true,
  penaltyMinutesPerWrong: penaltyPerWrongProp = DEFAULT_PENALTY_MINUTES_PER_WRONG,
}: {
  mockId: string;
  title: string;
  description?: string;
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
  const [codeAnswers, setCodeAnswers] = useState<Record<string, string>>({});
  const [codeResults, setCodeResults] = useState<
    Record<string, CodeSpecRunResult>
  >({});
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
      if (isNotebookProblem(p)) {
        const r = scores[p.id];
        if (r) sum += w * r.score;
      } else {
        const r = codeResults[p.id];
        if (r && typeof r.totalCount === "number" && r.totalCount > 0) {
          sum += w * ((r.passedCount ?? 0) / r.totalCount);
        }
      }
    }
    return sum;
  }, [problems, scores, codeResults]);

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
    const response = await fetch(appPath("/api/mocks"), {
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

    const answers = (data.answers ?? {}) as Record<string, unknown>;
    const restoredScores: Record<string, CompetitionRunResult> = {};
    const restoredCode: Record<string, string> = {};
    for (const p of problems) {
      const a = answers[p.id];
      if (isNotebookProblem(p)) {
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
      } else if (typeof a === "string" && a.trim()) {
        restoredCode[p.id] = a;
      }
    }
    setScores(restoredScores);
    setCodeAnswers(restoredCode);
    const logs =
      (answers.__competitionLogs as Record<string, LogEntry[]>) ?? {};
    setLogsByProblem(logs);
  }

  async function finish() {
    if (!sessionId) return;
    setSubmitting(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        ...codeAnswers,
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
      };
      const response = await fetch(appPath("/api/mocks"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          answers: payload,
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
                weightedScore: Number(b?.weightedScore) || undefined,
                metricLabel: scores[p.id]?.metricLabel,
                metricValue: scores[p.id]?.metricValue,
                passedCount: Number(b?.passedCount) || undefined,
                totalCount: Number(b?.totalCount) || undefined,
                isCoding: Boolean(b?.isCoding),
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
        {description ? (
          <p className="text-sm text-[var(--muted)]">{description}</p>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Laporan Final EKKA · Hari 2 (Programming)
          </p>
        )}
        <p className="display text-5xl">{result.percentage.toFixed(1)}%</p>
        <p className="text-sm text-[var(--muted)]">
          {result.score.toFixed(2)} / {result.maxScore} poin
        </p>
        <ul className="space-y-2">
          {problems.map((p) => {
            const b = result.breakdown[p.id];
            const notebook = isNotebookProblem(p);
            return (
              <li
                key={p.id}
                className="rounded-2xl border border-[var(--line)] p-3 text-sm"
              >
                <p className="font-semibold">{p.title}</p>
                <p className="text-[var(--muted)]">
                  {notebook
                    ? `${b?.metricLabel ?? "—"}: ${
                        typeof b?.metricValue === "number"
                          ? b.metricValue.toFixed(4)
                          : "belum submit"
                      }`
                    : `Tes: ${b?.passedCount ?? 0}/${b?.totalCount ?? "—"}`}{" "}
                  · {(b?.weightedScore ?? (b?.score ?? 0) * (b?.weight ?? 0)).toFixed(2)}{" "}
                  / {b?.weight ?? 0} poin
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  if (!sessionId || !endsAt) {
    const codingCount = problems.filter((p) => !isNotebookProblem(p)).length;
    const notebookCount = problems.filter((p) => isNotebookProblem(p)).length;
    return (
      <section className="panel mx-auto max-w-3xl space-y-6 rounded-3xl p-7">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Final EKKA · Hari 2 · Programming
          </p>
          <h1 className="display text-4xl">{title}</h1>
          {description ? (
            <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[var(--line)] p-3">
            <p className="text-xs text-[var(--muted)]">Coding</p>
            <p className="font-semibold">{codingCount}</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] p-3">
            <p className="text-xs text-[var(--muted)]">Notebook</p>
            <p className="font-semibold">{notebookCount}</p>
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
            Mix sementara: coding (codeSpec + tes otomatis) dan kompetisi
            notebook (Submit CSV).
          </li>
          <li>
            Komposisi &amp; bobot bersifat latihan — bukan juknis resmi Final
            EKKA.
          </li>
          {integrityMode === "off" ? (
            <li>
              Integritas: lockdown fullscreen browser tidak dipakai (sesuai
              fase final).
            </li>
          ) : null}
          {penaltyEnabledProp ? (
            <li>
              Penalti ICPC opsional (+{penaltyPerWrongProp} menit per salah
              submit pada soal yang akhirnya benar).
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
  const activeIsNotebook = isNotebookProblem(active);

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
            const notebook = isNotebookProblem(p);
            const s = scores[p.id];
            const c = codeResults[p.id];
            const done = notebook
              ? Boolean(s)
              : Boolean(codeAnswers[p.id]?.trim());
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
                  {notebook ? "Notebook" : "Coding"} ·{" "}
                  {TOPIC_LABELS[p.topic] ?? p.topic}
                  {notebook
                    ? s
                      ? ` · ${(s.score * 100).toFixed(0)}%`
                      : done
                        ? ""
                        : " · belum submit"
                    : c
                      ? ` · ${c.passedCount}/${c.totalCount}`
                      : done
                        ? " · draft"
                        : " · belum"}
                </p>
              </button>
            );
          })}
        </aside>

        <section className="panel space-y-4 rounded-3xl p-5">
          {activeIsNotebook ? (
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
          ) : (
            <>
              <div>
                <h2 className="display text-2xl">{active.title}</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {defaultProblemWeight(active)} poin · coding
                </p>
              </div>
              <Markdown content={active.stem} />
              {needsCodeSpecRunner(active) && active.codeSpec ? (
                <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-white/50 p-4">
                  <p className="text-xs text-[var(--muted)]">
                    Isi zona WRITE HERE saja. Tekan &quot;Jalankan tes&quot;
                    untuk menilai di server. Test case bersifat rahasia.
                  </p>
                  <CodeRunner
                    key={active.id}
                    problemId={active.id}
                    codeSpec={active.codeSpec}
                    onResult={(agg, userCode) => {
                      setCodeResults((current) => ({
                        ...current,
                        [active.id]: agg,
                      }));
                      setCodeAnswers((current) => ({
                        ...current,
                        [active.id]: userCode,
                      }));
                    }}
                    onCodeChange={(userCode) => {
                      setCodeAnswers((current) => ({
                        ...current,
                        [active.id]: userCode,
                      }));
                      setCodeResults((current) => {
                        if (!current[active.id]) return current;
                        const next = { ...current };
                        delete next[active.id];
                        return next;
                      });
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm text-[var(--bad)]">
                  Soal coding ini tidak memiliki codeSpec yang valid.
                </p>
              )}
            </>
          )}
        </section>
      </div>
      {error ? <p className="text-sm text-[var(--bad)]">{error}</p> : null}
    </div>
  );
}
