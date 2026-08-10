"use client";

import { useMemo, useState } from "react";
import { Markdown } from "@/components/markdown";
import type { ExamFacingProblem } from "@/lib/content/exam-facing-problem";
import type { CompetitionRunResult } from "@/lib/scoring";

type TabId = "overview" | "data" | "notebook" | "submit" | "logs";

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

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "data", label: "Data" },
  { id: "notebook", label: "Notebook" },
  { id: "submit", label: "Submit" },
  { id: "logs", label: "Logs" },
];

export function CompetitionWorkspace({
  problem,
  sessionId,
  logs,
  onGraded,
}: {
  problem: ExamFacingProblem;
  sessionId: string;
  logs: LogEntry[];
  onGraded: (result: CompetitionRunResult, logs: LogEntry[]) => void;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [notebookFile, setNotebookFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    ok: boolean;
    rowCount: number;
    headers: string[];
    warnings: string[];
  } | null>(null);
  const [busy, setBusy] = useState<"preview" | "grade" | null>(null);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState<CompetitionRunResult | null>(
    null,
  );

  const competition = problem.competitionSpec;
  const metricLabel = useMemo(
    () =>
      competition?.scoring.label ||
      competition?.scoring.mode ||
      "Metric",
    [competition],
  );

  if (!competition) {
    return (
      <p className="text-sm text-[var(--bad)]">
        Kompetisi tidak memiliki competitionSpec.
      </p>
    );
  }

  async function runPreview() {
    if (!submissionFile && !notebookFile) return;
    setBusy("preview");
    setError("");
    try {
      const form = new FormData();
      form.set("sessionId", sessionId);
      form.set("problemId", problem.id);
      form.set("action", "preview");
      if (submissionFile) form.set("submission", submissionFile);
      if (notebookFile) form.set("notebook", notebookFile);
      const res = await fetch("/api/competition/submit", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview gagal");
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview gagal");
    } finally {
      setBusy(null);
    }
  }

  async function runGrade() {
    if (!submissionFile && !notebookFile) return;
    setBusy("grade");
    setError("");
    try {
      const form = new FormData();
      form.set("sessionId", sessionId);
      form.set("problemId", problem.id);
      form.set("action", "grade");
      if (submissionFile) form.set("submission", submissionFile);
      if (notebookFile) form.set("notebook", notebookFile);
      const res = await fetch("/api/competition/submit", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit gagal");
      const result = data.competitionResult as CompetitionRunResult;
      setLastResult(result);
      const entry: LogEntry = {
        ...result,
        at: new Date().toISOString(),
      };
      onGraded(result, [...logs, entry]);
      setTab("submit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit gagal");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Kompetisi · {metricLabel}
          </p>
          <h2 className="display text-2xl">{problem.title}</h2>
        </div>
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
          Bobot {problem.weight ?? 5}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-[var(--line)] pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn !px-3 !py-1.5 text-sm ${tab === t.id ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "logs" && logs.length > 0 ? ` (${logs.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="prose-exam space-y-3">
          <p className="text-sm text-[var(--muted)]">{problem.stem}</p>
          <Markdown content={competition.overview} />
        </div>
      ) : null}

      {tab === "data" ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Unduh file data, lalu letakkan di folder yang sama dengan notebook
            starter.
          </p>
          {competition.files.map((file) => (
            <div
              key={file.name}
              className="rounded-2xl border border-[var(--line)] p-4"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{file.name}</p>
                  {file.description ? (
                    <p className="text-xs text-[var(--muted)]">
                      {file.description}
                    </p>
                  ) : null}
                  {typeof file.rowCount === "number" ? (
                    <p className="text-xs text-[var(--muted)]">
                      {file.rowCount} baris
                    </p>
                  ) : null}
                </div>
                <a
                  className="btn btn-secondary !px-3 !py-1.5 text-sm"
                  href={`/api/competition/${problem.id}/files/${encodeURIComponent(file.name)}`}
                >
                  Download
                </a>
              </div>
              {file.preview ? (
                <pre className="max-h-48 overflow-auto rounded-xl bg-[#111923] p-3 font-mono text-xs text-slate-200">
                  {file.preview}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {tab === "notebook" ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Unduh starter <code>.ipynb</code>, kerjakan di Jupyter / VS Code /
            Colab bersama file CSV dari tab Data, lalu kembali ke Submit.
          </p>
          <a
            className="btn btn-primary !px-4 !py-2 text-sm"
            href={`/api/competition/${problem.id}/notebook`}
          >
            Download starter notebook
          </a>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
            <li>Jupyter Lab / Notebook</li>
            <li>VS Code + Python extension</li>
            <li>Google Colab (unggah CSV + notebook)</li>
          </ul>
        </div>
      ) : null}

      {tab === "submit" ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Lampirkan <code>submission.csv</code> (disarankan) dan/atau
            notebook. Preview opsional; skor hanya dihitung setelah Anda klik{" "}
            <strong>Submit untuk dinilai</strong>.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">submission.csv</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm"
                onChange={(e) =>
                  setSubmissionFile(e.target.files?.[0] ?? null)
                }
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">notebook.ipynb (opsional)</span>
              <input
                type="file"
                accept=".ipynb,application/json"
                className="block w-full text-sm"
                onChange={(e) => setNotebookFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary !px-4 !py-2 text-sm"
              disabled={
                busy != null || (!submissionFile && !notebookFile)
              }
              onClick={() => void runPreview()}
            >
              {busy === "preview" ? "Memeriksa…" : "Preview"}
            </button>
            <button
              type="button"
              className="btn btn-accent !px-4 !py-2 text-sm"
              disabled={busy != null || (!submissionFile && !notebookFile)}
              onClick={() => void runGrade()}
            >
              {busy === "grade" ? "Menilai…" : "Submit untuk dinilai"}
            </button>
          </div>
          {preview ? (
            <div className="rounded-2xl border border-[var(--line)] p-3 text-sm">
              <p>
                Preview: {preview.rowCount} baris · kolom{" "}
                {preview.headers.join(", ") || "—"}
              </p>
              {preview.warnings.length > 0 ? (
                <ul className="mt-1 list-disc pl-5 text-[var(--bad)]">
                  {preview.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[var(--good)]">Skema terlihat OK.</p>
              )}
            </div>
          ) : null}
          {lastResult ? (
            <div className="rounded-2xl border border-[var(--accent)] bg-[rgba(56,120,90,0.08)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                Skor publik
              </p>
              <p className="display text-3xl">
                {lastResult.metricLabel}: {lastResult.metricValue.toFixed(4)}
              </p>
              <p className="text-sm text-[var(--muted)]">
                Skor proporsional {(lastResult.score * 100).toFixed(1)}% ·{" "}
                {lastResult.rowCount} baris · {lastResult.gradedBy}
              </p>
              <p className="mt-2 text-sm">{lastResult.log}</p>
              {lastResult.summary ? (
                <p className="text-sm text-[var(--muted)]">
                  {lastResult.summary}
                </p>
              ) : null}
            </div>
          ) : null}
          {error ? <p className="text-sm text-[var(--bad)]">{error}</p> : null}
        </div>
      ) : null}

      {tab === "logs" ? (
        <div className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Belum ada submission. Setelah Submit, riwayat muncul di sini.
            </p>
          ) : (
            logs
              .slice()
              .reverse()
              .map((entry, i) => (
                <div
                  key={`${entry.at ?? i}-${i}`}
                  className="rounded-2xl border border-[var(--line)] p-3 text-sm"
                >
                  <p className="font-semibold">
                    {entry.metricLabel ?? "Metric"}:{" "}
                    {typeof entry.metricValue === "number"
                      ? entry.metricValue.toFixed(4)
                      : "—"}{" "}
                    ·{" "}
                    {typeof entry.score === "number"
                      ? `${(entry.score * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {entry.at
                      ? new Date(entry.at).toLocaleString("id-ID")
                      : ""}
                    {entry.gradedBy ? ` · ${entry.gradedBy}` : ""}
                    {typeof entry.rowCount === "number"
                      ? ` · ${entry.rowCount} baris`
                      : ""}
                  </p>
                  {entry.log ? <p className="mt-1">{entry.log}</p> : null}
                </div>
              ))
          )}
        </div>
      ) : null}
    </div>
  );
}
