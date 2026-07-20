"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    loadPyodide?: (opts?: { indexURL?: string }) => Promise<{
      runPythonAsync: (code: string) => Promise<unknown>;
      setStdout: (opts: { batched: (s: string) => void }) => void;
    }>;
  }
}

let pyodidePromise: Promise<NonNullable<Window["loadPyodide"]> extends (
  ...args: infer _A
) => Promise<infer R>
  ? R
  : never> | null = null;

async function getPyodide() {
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

export function PythonRunner({
  initialCode = "print('hello')",
  onOutput,
}: {
  initialCode?: string;
  onOutput?: (output: string) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [readyHint, setReadyHint] = useState("Pyodide siap dimuat");

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  async function run() {
    setLoading(true);
    setReadyHint("Memuat runtime Python…");
    try {
      const py = await getPyodide();
      let stdout = "";
      py.setStdout({
        batched: (s) => {
          stdout += s;
        },
      });
      await py.runPythonAsync(code);
      setOutput(stdout.trim() || "(tidak ada output)");
      onOutput?.(stdout.trim());
      setReadyHint("Selesai");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      setOutput(msg);
      setReadyHint("Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        className="textarea font-mono text-sm"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={8}
      />
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={run} disabled={loading}>
          {loading ? "Menjalankan…" : "Jalankan Python"}
        </button>
        <span className="text-xs text-[var(--muted)]">{readyHint}</span>
      </div>
      <pre className="overflow-x-auto rounded-xl bg-[#18212c] p-3 text-sm text-[#e8eef5]">
        {output || "Output akan muncul di sini"}
      </pre>
    </div>
  );
}
