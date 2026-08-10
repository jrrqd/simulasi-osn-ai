"use client";

/**
 * Shared Pyodide loader — used by PythonRunner, CodeRunner, and competition notebooks.
 */

type PyodideFS = {
  mkdir: (path: string) => void;
  writeFile: (path: string, data: string) => void;
  readFile: (path: string, opts?: { encoding: string }) => string;
};

export type Pyodide = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr?: (opts: { batched: (s: string) => void }) => void;
  setStdin?: (opts: { stdin: () => string | undefined }) => void;
  globals?: { set: (k: string, v: unknown) => void };
  loadPackage: (names: string | string[]) => Promise<void>;
  FS: PyodideFS;
};

declare global {
  interface Window {
    loadPyodide?: (opts?: { indexURL?: string }) => Promise<Pyodide>;
  }
}

const PYODIDE_INDEX = "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/";
const DATA_DIR = "/data";
const DEFAULT_COMPETITION_TIMEOUT_MS = 120_000;

let pyodidePromise: Promise<Pyodide> | null = null;
let pyodideDataSciencePromise: Promise<Pyodide> | null = null;

async function loadPyodideScript(): Promise<void> {
  if (window.loadPyodide) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${PYODIDE_INDEX}pyodide.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat Pyodide"));
    document.head.appendChild(script);
  });
}

export async function getPyodide(): Promise<Pyodide> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      await loadPyodideScript();
      return window.loadPyodide!({ indexURL: PYODIDE_INDEX });
    })();
  }
  return pyodidePromise;
}

/** Pyodide with pandas (and numpy) pre-loaded for competition notebooks. */
export async function getPyodideDataScience(): Promise<Pyodide> {
  if (!pyodideDataSciencePromise) {
    pyodideDataSciencePromise = (async () => {
      const py = await getPyodide();
      await py.loadPackage("pandas");
      return py;
    })();
  }
  return pyodideDataSciencePromise;
}

/** Fire-and-forget warm-up so the first "Jalankan" in an exam is faster. */
export function preloadPyodide(): void {
  if (typeof window === "undefined") return;
  void getPyodide().catch(() => {
    // Non-blocking: exam continues without a preloaded runtime.
  });
}

/** Preload pandas stack for Kaggle-style exams. */
export function preloadPyodideDataScience(): void {
  if (typeof window === "undefined") return;
  void getPyodideDataScience().catch(() => {
    // Non-blocking: student can retry from Notebook tab.
  });
}

function ensureDataDir(py: Pyodide): void {
  try {
    py.FS.mkdir(DATA_DIR);
  } catch {
    // Directory may already exist between runs.
  }
}

/** Write competition CSVs into Pyodide virtual FS under /data/. */
export function mountCompetitionFiles(
  py: Pyodide,
  files: Record<string, string>,
): void {
  ensureDataDir(py);
  for (const [name, content] of Object.entries(files)) {
    py.FS.writeFile(`${DATA_DIR}/${name}`, content);
  }
}

/** Read a text file from Pyodide virtual FS; returns null if missing. */
export function readVirtualFile(py: Pyodide, path: string): string | null {
  try {
    return py.FS.readFile(path, { encoding: "utf8" });
  } catch {
    return null;
  }
}

export type CompetitionRunOutcome = {
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: string;
  submissionCsv: string | null;
};

/**
 * Run student competition Python with stdout/stderr capture and timeout.
 * Looks for submission.csv in /data/ after execution.
 */
export async function runCompetitionCode(
  py: Pyodide,
  code: string,
  timeLimitMs = DEFAULT_COMPETITION_TIMEOUT_MS,
): Promise<CompetitionRunOutcome> {
  let stdout = "";
  let stderr = "";
  py.setStdout({
    batched: (s) => {
      stdout += s;
    },
  });
  if (py.setStderr) {
    py.setStderr({
      batched: (s) => {
        stderr += s;
      },
    });
  }

  const wrapped = `
import os
os.chdir(${JSON.stringify(DATA_DIR)})
${code}
`;

  let timedOut = false;
  let error: string | undefined;
  const runPromise = py.runPythonAsync(wrapped).then(
    () => undefined as void,
    (e: unknown) => {
      error = e instanceof Error ? e.message : String(e);
    },
  );
  const timeoutPromise = new Promise<void>((resolve) => {
    window.setTimeout(() => {
      timedOut = true;
      resolve();
    }, Math.max(1000, timeLimitMs));
  });

  await Promise.race([runPromise, timeoutPromise]);
  if (timedOut) {
    return {
      stdout: stdout.trimEnd(),
      stderr: stderr.trimEnd(),
      timedOut: true,
      error: "Waktu habis — kurangi kompleksitas atau perbaiki loop tak berujung.",
      submissionCsv: readVirtualFile(py, `${DATA_DIR}/submission.csv`),
    };
  }
  await runPromise;

  return {
    stdout: stdout.trimEnd(),
    stderr: stderr.trimEnd(),
    timedOut: false,
    error,
    submissionCsv: readVirtualFile(py, `${DATA_DIR}/submission.csv`),
  };
}

/**
 * Run Python code with optional stdin string; capture stdout.
 * Timeout via Promise.race (Pyodide has no native interrupt).
 */
export async function runPythonWithInput(
  code: string,
  stdin: string,
  timeLimitMs: number,
): Promise<{ stdout: string; timedOut: boolean; error?: string }> {
  const py = await getPyodide();
  let stdout = "";
  py.setStdout({
    batched: (s) => {
      stdout += s;
    },
  });

  const escaped = JSON.stringify(stdin ?? "");
  const wrapped = `
import sys, io
sys.stdin = io.StringIO(${escaped})
${code}
`;

  let timedOut = false;
  let error: string | undefined;
  const runPromise = py.runPythonAsync(wrapped).then(
    () => undefined as void,
    (e: unknown) => {
      error = e instanceof Error ? e.message : String(e);
    },
  );
  const timeoutPromise = new Promise<void>((resolve) => {
    window.setTimeout(() => {
      timedOut = true;
      resolve();
    }, Math.max(100, timeLimitMs));
  });

  await Promise.race([runPromise, timeoutPromise]);
  if (timedOut) {
    return { stdout: stdout.trimEnd(), timedOut: true, error: "TLE" };
  }
  await runPromise;
  return { stdout: stdout.trimEnd(), timedOut: false, error };
}
