"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type StudyCaseBundle = {
  caseId: string;
  caseTitle?: string;
  problemIds: string[];
};

function readBundleForProblem(problemId: string): StudyCaseBundle | null {
  if (typeof window === "undefined") return null;
  try {
    const direct = sessionStorage.getItem(`study-case-for:${problemId}`);
    if (direct) {
      const parsed = JSON.parse(direct) as StudyCaseBundle;
      if (Array.isArray(parsed.problemIds) && parsed.problemIds.length > 1) {
        return parsed;
      }
    }
    // Fallback: scan recent case keys
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith("study-case:")) continue;
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StudyCaseBundle;
      if (parsed.problemIds?.includes(problemId)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function StudyCaseNav({ problemId }: { problemId: string }) {
  const [bundle, setBundle] = useState<StudyCaseBundle | null>(null);

  useEffect(() => {
    setBundle(readBundleForProblem(problemId));
  }, [problemId]);

  if (!bundle) return null;

  const idx = bundle.problemIds.indexOf(problemId);
  if (idx < 0) return null;

  const prevId = idx > 0 ? bundle.problemIds[idx - 1] : null;
  const nextId =
    idx < bundle.problemIds.length - 1 ? bundle.problemIds[idx + 1] : null;

  return (
    <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-3xl px-4 py-3 text-sm">
      <p className="text-[var(--muted)]">
        Studi kasus
        {bundle.caseTitle ? ` · ${bundle.caseTitle}` : ""} · bagian {idx + 1}/
        {bundle.problemIds.length}
      </p>
      <div className="flex flex-wrap gap-2">
        {prevId ? (
          <Link className="btn btn-secondary !px-3 !py-1.5" href={`/practice/${prevId}`}>
            ← Sebelumnya
          </Link>
        ) : null}
        {nextId ? (
          <Link className="btn btn-accent !px-3 !py-1.5" href={`/practice/${nextId}`}>
            Selanjutnya →
          </Link>
        ) : (
          <span className="self-center text-xs text-[var(--muted)]">
            Bagian terakhir
          </span>
        )}
      </div>
    </div>
  );
}
