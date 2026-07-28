"use client";

import { useMemo, useState } from "react";
import type { CodeSpec } from "@/lib/content/types";
import {
  DEFAULT_WRITE_CLOSE,
  DEFAULT_WRITE_OPEN,
  ensureSkeletonMarkersFromRanges,
  parseSkeleton,
  resolveMarkers,
} from "@/lib/ai/code-skeleton";
import {
  aggregateTestCaseOutcomes,
  gradeCase,
  type RunCodeSpecAggregate,
  type TestCaseOutcome,
} from "@/lib/scoring/test-case-runner";
import { validateUserCodeAgainstSkeleton } from "@/lib/scoring/index";
import { preloadPyodide, runPythonWithInput } from "@/lib/pyodide-client";

export { preloadPyodide };

export function CodeRunner({
  codeSpec,
  onResult,
  onCodeChange,
}: {
  codeSpec: CodeSpec;
  onResult?: (result: RunCodeSpecAggregate, userCode: string) => void;
  onCodeChange?: (userCode: string) => void;
}) {
  const markers = resolveMarkers(codeSpec.lockedMarkers);
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
  const [outcomes, setOutcomes] = useState<TestCaseOutcome[]>([]);
  const [activeCase, setActiveCase] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState(
    parsed.ok
      ? "Edit hanya di zona WRITE HERE"
      : (parsed.error ?? "Skeleton tidak valid"),
  );
  const [lastAggregate, setLastAggregate] = useState<RunCodeSpecAggregate | null>(
    null,
  );

  function buildUserCode(middle: string) {
    if (!parsed.ok) return skeleton;
    const mid = middle.endsWith("\n") ? middle : `${middle}\n`;
    return `${parsed.before}\n${mid}${parsed.after}`;
  }

  function handleEditableChange(value: string) {
    setEditable(value);
    const code = buildUserCode(value);
    onCodeChange?.(code);
  }

  async function runCases(onlyIndex?: number) {
    if (!parsed.ok) {
      setHint(parsed.error ?? "Skeleton tidak valid");
      return;
    }
    setLoading(true);
    setHint("Menjalankan test case…");
    preloadPyodide();

    const userCode = buildUserCode(editable);
    const lock = validateUserCodeAgainstSkeleton({
      skeleton,
      userCode,
      markers,
    });
    if (!lock.ok) {
      const empty = aggregateTestCaseOutcomes({
        outcomes: [],
        skeletonViolated: true,
      });
      setOutcomes([]);
      setLastAggregate(empty);
      onResult?.(empty, userCode);
      setHint(lock.error ?? "Skeleton dilanggar");
      setLoading(false);
      return;
    }

    const cases = codeSpec.testCases;
    const indices =
      onlyIndex == null
        ? cases.map((_, i) => i)
        : [onlyIndex].filter((i) => i >= 0 && i < cases.length);

    const nextOutcomes: TestCaseOutcome[] = [...outcomes];
    let timedOut = false;

    for (const i of indices) {
      const tc = cases[i]!;
      const result = await runPythonWithInput(
        userCode,
        tc.input ?? "",
        codeSpec.timeLimitMs,
      );
      if (result.timedOut) {
        timedOut = true;
        nextOutcomes[i] = {
          case: tc,
          index: i,
          passed: false,
          actualOutput: result.stdout,
          reason: "TLE (melewati batas waktu)",
        };
        break;
      }
      if (result.error && result.error !== "TLE") {
        nextOutcomes[i] = {
          case: tc,
          index: i,
          passed: false,
          actualOutput: result.stdout || result.error,
          reason: result.error,
        };
      } else {
        nextOutcomes[i] = gradeCase(result.stdout, tc, i);
      }
    }

    // Fill missing when running all
    if (onlyIndex == null) {
      for (let i = 0; i < cases.length; i++) {
        if (!nextOutcomes[i]) {
          nextOutcomes[i] = {
            case: cases[i]!,
            index: i,
            passed: false,
            actualOutput: "",
            reason: timedOut ? "Dilewati (TLE sebelumnya)" : "Belum dijalankan",
          };
        }
      }
    }

    const aggregate = aggregateTestCaseOutcomes({
      outcomes: nextOutcomes.filter(Boolean),
      timedOut,
    });
    setOutcomes(nextOutcomes.filter(Boolean));
    setLastAggregate(aggregate);
    onResult?.(aggregate, userCode);
    setHint(
      timedOut
        ? "TLE — skor coding = 0"
        : `Lulus ${aggregate.passedCount}/${aggregate.totalCount} test case`,
    );
    setLoading(false);
  }

  const active = outcomes[activeCase];

  return (
    <div className="space-y-3">
      {!parsed.ok ? (
        <p className="text-sm text-[var(--bad)]">{parsed.error}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
          <div className="flex items-center gap-2 border-b border-[var(--line)] bg-black/[0.04] px-3 py-1.5 text-xs text-[var(--muted)]">
            <span aria-hidden>🔒</span>
            Skeleton terkunci — edit hanya antara{" "}
            <code className="rounded bg-black/10 px-1">{markers.open}</code> dan{" "}
            <code className="rounded bg-black/10 px-1">{markers.close}</code>
          </div>
          <pre className="max-h-40 overflow-auto bg-[#18212c]/p-3 font-mono text-xs text-[#9aa7b5]">
            {parsed.before || DEFAULT_WRITE_OPEN}
          </pre>
          <textarea
            className="textarea w-full rounded-none border-0 border-y border-[var(--line)] font-mono text-sm"
            value={editable}
            onChange={(e) => handleEditableChange(e.target.value)}
            rows={8}
            spellCheck={false}
            aria-label="Zona tulis kode"
          />
          <pre className="max-h-40 overflow-auto bg-[#18212c] p-3 font-mono text-xs text-[#9aa7b5]">
            {parsed.after || DEFAULT_WRITE_CLOSE}
          </pre>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading || !parsed.ok}
          onClick={() => void runCases()}
        >
          {loading ? "Menjalankan…" : "Jalankan semua test case"}
        </button>
        <span className="text-xs text-[var(--muted)]">{hint}</span>
        {lastAggregate && (
          <span className="rounded-full bg-white/70 px-2 py-1 text-xs">
            {lastAggregate.passedCount}/{lastAggregate.totalCount} lulus · bobot{" "}
            {lastAggregate.passedWeight}/{lastAggregate.totalWeight}
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-white/50 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Test cases ({codeSpec.testCases.length})
        </p>
        <div className="mb-3 flex flex-wrap gap-1">
          {codeSpec.testCases.map((_, i) => {
            const o = outcomes[i];
            const status =
              o == null ? "pending" : o.passed ? "pass" : "fail";
            return (
              <button
                key={i}
                type="button"
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  activeCase === i ? "ring-2 ring-[var(--accent)]" : ""
                } ${
                  status === "pass"
                    ? "bg-[rgba(31,122,76,0.14)] text-[var(--ok)]"
                    : status === "fail"
                      ? "bg-red-50 text-[var(--bad)]"
                      : "bg-black/5 text-[var(--muted)]"
                }`}
                onClick={() => setActiveCase(i)}
              >
                #{i + 1}
                {status === "pass" ? " ✓" : status === "fail" ? " ✗" : ""}
              </button>
            );
          })}
        </div>
        {codeSpec.testCases[activeCase] && (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary !py-1"
                disabled={loading}
                onClick={() => void runCases(activeCase)}
              >
                Jalankan case #{activeCase + 1}
              </button>
              <span className="text-xs text-[var(--muted)]">
                TL {codeSpec.timeLimitMs}ms · ML {codeSpec.memoryLimitMb}MB
              </span>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Input (stdin)</p>
              <pre className="mt-1 overflow-x-auto rounded-xl bg-black/[0.04] p-2 font-mono text-xs">
                {codeSpec.testCases[activeCase]!.input || "(kosong)"}
              </pre>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Expected stdout</p>
              <pre className="mt-1 overflow-x-auto rounded-xl bg-black/[0.04] p-2 font-mono text-xs">
                {codeSpec.testCases[activeCase]!.expectedOutput}
              </pre>
            </div>
            {active && (
              <div>
                <p className="text-xs text-[var(--muted)]">
                  Actual {active.passed ? "(pass)" : `(fail: ${active.reason})`}
                </p>
                <pre
                  className={`mt-1 overflow-x-auto rounded-xl p-2 font-mono text-xs ${
                    active.passed
                      ? "bg-[rgba(31,122,76,0.08)]"
                      : "bg-red-50"
                  }`}
                >
                  {active.actualOutput || "(kosong)"}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
