"use client";

import { useMemo, useState } from "react";
import type { ClientCodeSpec } from "@/lib/content/types";
import {
  DEFAULT_WRITE_CLOSE,
  DEFAULT_WRITE_OPEN,
  assembleCode,
  ensureSkeletonMarkersFromRanges,
  parseSkeleton,
  resolveMarkers,
} from "@/lib/ai/code-skeleton";
import type { CodeSpecRunResult } from "@/lib/scoring";

export function CodeRunner({
  problemId,
  codeSpec,
  onResult,
  onCodeChange,
}: {
  problemId: string;
  codeSpec: ClientCodeSpec;
  onResult?: (result: CodeSpecRunResult, userCode: string) => void;
  onCodeChange?: (userCode: string) => void;
}) {
  const markers = useMemo(
    () => resolveMarkers(codeSpec.lockedMarkers),
    [codeSpec.lockedMarkers],
  );
  const skeleton = useMemo(
    () =>
      ensureSkeletonMarkersFromRanges(
        codeSpec.skeleton,
        codeSpec.lockedRanges,
        markers,
      ),
    [codeSpec.skeleton, codeSpec.lockedRanges, markers],
  );
  const parsed = useMemo(
    () => parseSkeleton(skeleton, markers),
    [skeleton, markers],
  );
  const [editable, setEditable] = useState(() =>
    parsed.ok ? parsed.editable.replace(/^\n/, "").replace(/\n$/, "") : "",
  );
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(
    parsed.ok ? "Hanya bagian WRITE HERE yang dapat diedit." : parsed.error ?? "Skeleton tidak valid",
  );
  const [result, setResult] = useState<CodeSpecRunResult | null>(null);

  function buildUserCode(middle: string) {
    return assembleCode(skeleton, middle, markers).code;
  }

  function handleChange(value: string) {
    setEditable(value);
    setResult(null);
    setFeedback("Perubahan belum diuji.");
    onCodeChange?.(buildUserCode(value));
  }

  async function runTests() {
    if (!parsed.ok) return;
    setLoading(true);
    setFeedback("Menjalankan tes tersembunyi…");
    const userCode = buildUserCode(editable);
    try {
      const response = await fetch("/api/code/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, userCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menjalankan tes");
      const aggregate = data.result as CodeSpecRunResult;
      setResult(aggregate);
      onResult?.(aggregate, userCode);
      setFeedback(
        aggregate.skeletonViolated
          ? "Skeleton tidak boleh diubah."
          : aggregate.timedOut
            ? "Program melewati batas waktu."
            : aggregate.memoryExceeded
              ? "Program melewati batas memori."
              : `Lulus ${aggregate.passedCount ?? 0}/${aggregate.totalCount ?? codeSpec.testCaseCount} test case`,
      );
    } catch (error) {
      setResult(null);
      setFeedback(error instanceof Error ? error.message : "Gagal menjalankan tes");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {!parsed.ok ? (
        <p className="text-sm text-[var(--bad)]">{parsed.error}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-[#18212c] shadow-sm">
          <div className="border-b border-slate-700 px-4 py-2 text-xs text-slate-400">
            Python · hanya zona WRITE HERE yang dapat diedit
          </div>
          <pre className="overflow-x-auto px-4 pt-4 font-mono text-sm leading-6 text-slate-400">
            {parsed.before || DEFAULT_WRITE_OPEN}
          </pre>
          <textarea
            className="min-h-48 w-full resize-y border-0 bg-[#111923] px-4 py-2 font-mono text-sm leading-6 text-slate-100 outline-none ring-inset focus:ring-2 focus:ring-[var(--accent)]"
            value={editable}
            onChange={(event) => handleChange(event.target.value)}
            rows={8}
            spellCheck={false}
            aria-label="Zona tulis kode"
          />
          <pre className="overflow-x-auto px-4 pb-4 pt-2 font-mono text-sm leading-6 text-slate-400">
            {parsed.after || DEFAULT_WRITE_CLOSE}
          </pre>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading || !parsed.ok}
          onClick={() => void runTests()}
        >
          {loading ? "Menjalankan…" : "Jalankan tes"}
        </button>
        <p
          className={`text-sm ${
            result && (result.passedCount ?? 0) === (result.totalCount ?? -1)
              ? "text-[var(--ok)]"
              : "text-[var(--muted)]"
          }`}
          aria-live="polite"
        >
          {feedback}
        </p>
      </div>
      <p className="text-xs text-[var(--muted)]">
        {codeSpec.testCaseCount} tes tersembunyi · batas waktu {codeSpec.timeLimitMs} ms · memori {codeSpec.memoryLimitMb} MB
      </p>
    </div>
  );
}
