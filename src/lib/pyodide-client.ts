"use client";

/**
 * Shared Pyodide loader — used by PythonRunner and CodeRunner.
 */

declare global {
  interface Window {
    loadPyodide?: (opts?: { indexURL?: string }) => Promise<{
      runPythonAsync: (code: string) => Promise<unknown>;
      setStdout: (opts: { batched: (s: string) => void }) => void;
      setStdin?: (opts: { stdin: () => string | undefined }) => void;
      globals?: { set: (k: string, v: unknown) => void };
    }>;
  }
}

type Pyodide = NonNullable<Window["loadPyodide"]> extends (
  ...args: infer _A
) => Promise<infer R>
  ? R
  : never;

let pyodidePromise: Promise<Pyodide> | null = null;

export async function getPyodide(): Promise<Pyodide> {
  if (!pyodidePromise) {
    if (!window.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Gagal memuat Pyodide"));
        document.head.appendChild(script);
      });
    }
    pyodidePromise = window.loadPyodide!({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/",
    });
  }
  return pyodidePromise;
}

/** Fire-and-forget warm-up so the first "Jalankan" in an exam is faster. */
export function preloadPyodide(): void {
  if (typeof window === "undefined") return;
  void getPyodide().catch(() => {
    // Non-blocking: exam continues without a preloaded runtime.
  });
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

  // Inject stdin via sys.stdin for input()
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
  // Give a brief grace if timed out — stdout may be partial
  if (timedOut) {
    return { stdout: stdout.trimEnd(), timedOut: true, error: "TLE" };
  }
  await runPromise;
  return { stdout: stdout.trimEnd(), timedOut: false, error };
}
