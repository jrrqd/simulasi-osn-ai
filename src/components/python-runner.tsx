"use client";

import { useState } from "react";
import { getPyodide, preloadPyodide } from "@/lib/pyodide-client";

export { preloadPyodide };

export function PythonRunner({
  initialCode = "print('hello')",
  onOutput,
}: {
  initialCode?: string;
  onOutput?: (output: string) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [codeEpoch, setCodeEpoch] = useState(initialCode);
  if (initialCode !== codeEpoch) {
    setCodeEpoch(initialCode);
    setCode(initialCode);
  }
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [readyHint, setReadyHint] = useState("Pyodide siap dimuat");

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
