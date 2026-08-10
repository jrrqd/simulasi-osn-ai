"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClientCompetitionSpec } from "@/lib/content/types";
import { buildCompetitionStarterCode } from "@/lib/notebook/build-starter-notebook";
import {
  getPyodideDataScience,
  mountCompetitionFiles,
  runCompetitionCode,
} from "@/lib/pyodide-client";

const STORAGE_PREFIX = "competition-notebook:";

function storageKey(sessionId: string, problemId: string): string {
  return `${STORAGE_PREFIX}${sessionId}:${problemId}`;
}

function loadDraft(sessionId: string, problemId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(storageKey(sessionId, problemId));
  } catch {
    return null;
  }
}

function saveDraft(sessionId: string, problemId: string, code: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(sessionId, problemId), code);
  } catch {
    // Quota exceeded — draft not persisted.
  }
}

type LoadState = "idle" | "loading" | "ready" | "error";

export function CompetitionNotebookRunner({
  problemId,
  sessionId,
  competition,
  onSubmissionReady,
  onGoToSubmit,
}: {
  problemId: string;
  sessionId: string;
  competition: ClientCompetitionSpec;
  onSubmissionReady: (file: File | null) => void;
  onGoToSubmit?: () => void;
}) {
  const defaultCode = useMemo(
    () =>
      buildCompetitionStarterCode({
        targetColumn: competition.submission.targetColumn,
      }),
    [competition.submission.targetColumn],
  );

  const [code, setCode] = useState(() => {
    const draft = loadDraft(sessionId, problemId);
    return draft ?? defaultCode;
  });
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState("");
  const [running, setRunning] = useState(false);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [runError, setRunError] = useState("");
  const [submissionPreview, setSubmissionPreview] = useState<string | null>(
    null,
  );

  const initRuntime = useCallback(async () => {
    setLoadState("loading");
    setLoadError("");
    try {
      const py = await getPyodideDataScience();
      const files: Record<string, string> = {};
      for (const file of competition.files) {
        const res = await fetch(
          `/api/competition/${problemId}/files/${encodeURIComponent(file.name)}`,
        );
        if (!res.ok) {
          throw new Error(`Gagal memuat ${file.name}`);
        }
        files[file.name] = await res.text();
      }
      mountCompetitionFiles(py, files);
      setLoadState("ready");
    } catch (e) {
      setLoadState("error");
      setLoadError(
        e instanceof Error ? e.message : "Gagal memuat Python + data",
      );
    }
  }, [competition.files, problemId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void initRuntime();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initRuntime]);

  useEffect(() => {
    saveDraft(sessionId, problemId, code);
  }, [code, problemId, sessionId]);

  async function handleRun() {
    setRunning(true);
    setStdout("");
    setStderr("");
    setRunError("");
    setSubmissionPreview(null);
    onSubmissionReady(null);
    try {
      if (loadState !== "ready") {
        await initRuntime();
      }
      const py = await getPyodideDataScience();
      const files: Record<string, string> = {};
      for (const file of competition.files) {
        const res = await fetch(
          `/api/competition/${problemId}/files/${encodeURIComponent(file.name)}`,
        );
        if (!res.ok) throw new Error(`Gagal memuat ${file.name}`);
        files[file.name] = await res.text();
      }
      mountCompetitionFiles(py, files);

      const result = await runCompetitionCode(py, code);
      setStdout(result.stdout || "(tidak ada output)");
      setStderr(result.stderr);
      if (result.timedOut) {
        setRunError(result.error ?? "Waktu habis");
      } else if (result.error) {
        setRunError(result.error);
      }

      if (result.submissionCsv?.trim()) {
        const preview = result.submissionCsv.trim();
        setSubmissionPreview(preview);
        const blob = new Blob([preview], { type: "text/csv" });
        onSubmissionReady(
          new File([blob], "submission.csv", { type: "text/csv" }),
        );
      }
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Gagal menjalankan kode");
    } finally {
      setRunning(false);
    }
  }

  const statusLabel =
    loadState === "loading"
      ? "Memuat Python + pandas + data…"
      : loadState === "ready"
        ? "Siap — data CSV dimuat di /data/"
        : loadState === "error"
          ? loadError
          : "Menunggu…";

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Kerjakan langsung di browser dengan Python + pandas. Data kompetisi
        dimuat otomatis; setelah Run, kirim <code>submission.csv</code> ke tab
        Submit.
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <span
          className={`rounded-full px-2 py-0.5 ${
            loadState === "ready"
              ? "bg-[rgba(56,120,90,0.15)] text-[var(--accent)]"
              : loadState === "error"
                ? "bg-[rgba(180,60,60,0.12)] text-[var(--bad)]"
                : "bg-[var(--line)]"
          }`}
        >
          {statusLabel}
        </span>
        {loadState === "error" ? (
          <button
            type="button"
            className="btn btn-secondary !px-2 !py-0.5 text-xs"
            onClick={() => void initRuntime()}
          >
            Coba lagi
          </button>
        ) : null}
      </div>

      <textarea
        className="textarea min-h-[280px] font-mono text-sm"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary !px-4 !py-2 text-sm"
          disabled={running || loadState === "loading"}
          onClick={() => void handleRun()}
        >
          {running ? "Menjalankan…" : "Run"}
        </button>
        <button
          type="button"
          className="btn btn-secondary !px-3 !py-2 text-sm"
          onClick={() => setCode(defaultCode)}
          disabled={running}
        >
          Reset starter
        </button>
      </div>

      {(stdout || stderr || runError) && (
        <div className="space-y-2">
          {runError ? (
            <p className="text-sm text-[var(--bad)]">{runError}</p>
          ) : null}
          <pre className="max-h-48 overflow-auto rounded-xl bg-[#18212c] p-3 text-sm text-[#e8eef5]">
            {stdout}
            {stderr ? `\n[stderr]\n${stderr}` : ""}
          </pre>
        </div>
      )}

      {submissionPreview ? (
        <div className="space-y-2 rounded-2xl border border-[var(--accent)] bg-[rgba(56,120,90,0.06)] p-4">
          <p className="text-sm font-semibold text-[var(--accent)]">
            submission.csv siap
          </p>
          <pre className="max-h-32 overflow-auto rounded-xl bg-[#111923] p-3 font-mono text-xs text-slate-200">
            {submissionPreview.split("\n").slice(0, 8).join("\n")}
            {submissionPreview.split("\n").length > 8 ? "\n…" : ""}
          </pre>
          {onGoToSubmit ? (
            <button
              type="button"
              className="btn btn-accent !px-4 !py-2 text-sm"
              onClick={onGoToSubmit}
            >
              Kirim ke Submit
            </button>
          ) : null}
        </div>
      ) : null}

      <details className="rounded-2xl border border-[var(--line)] p-3 text-sm">
        <summary className="cursor-pointer font-medium text-[var(--muted)]">
          Kerja di luar platform (opsional)
        </summary>
        <div className="mt-3 space-y-2 text-[var(--muted)]">
          <p>
            Unduh starter <code>.ipynb</code> dan CSV jika ingin memakai Jupyter,
            VS Code, atau Google Colab.
          </p>
          <a
            className="btn btn-secondary !inline-flex !px-3 !py-1.5 text-sm"
            href={`/api/competition/${problemId}/notebook`}
          >
            Download starter notebook
          </a>
          <ul className="list-disc space-y-1 pl-5">
            {competition.files.map((f) => (
              <li key={f.name}>
                <a
                  className="text-[var(--accent)] underline"
                  href={`/api/competition/${problemId}/files/${encodeURIComponent(f.name)}`}
                >
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
