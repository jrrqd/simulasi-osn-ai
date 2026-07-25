import Link from "next/link";
import { Check } from "lucide-react";
import type { ProblemProgress } from "@/lib/attempts";

function scorePercent(score: number) {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

function ProgressBadge({ progress }: { progress: ProblemProgress }) {
  const pct = scorePercent(progress.bestScore);
  const tone =
    pct >= 100
      ? "bg-[rgba(31,122,76,0.14)] text-[var(--ok)]"
      : pct >= 50
        ? "bg-[rgba(161,92,7,0.12)] text-[var(--warn)]"
        : "bg-[rgba(180,35,24,0.1)] text-[var(--bad)]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
      title={
        progress.attemptCount > 1
          ? `Dikerjakan ${progress.attemptCount}× · skor terakhir ${scorePercent(progress.lastScore)}%`
          : "Sudah dikerjakan"
      }
    >
      <Check size={12} strokeWidth={2.5} aria-hidden />
      {pct >= 100 ? "Selesai" : "Dikerjakan"} · {pct}%
      {progress.attemptCount > 1 ? (
        <span className="opacity-70">· {progress.attemptCount}×</span>
      ) : null}
    </span>
  );
}

export function PracticeProblemCard({
  id,
  title,
  meta,
  progress,
}: {
  id: string;
  title: string;
  meta: string;
  progress?: ProblemProgress;
}) {
  const done = Boolean(progress && progress.attemptCount > 0);

  return (
    <Link
      href={`/practice/${id}`}
      className={`panel block rounded-2xl p-4 hover:bg-white/90 ${
        done ? "border-[rgba(15,110,86,0.28)]" : ""
      }`}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
        Side quest
      </p>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-[var(--muted)]">{meta}</p>
        </div>
        {progress && progress.attemptCount > 0 ? (
          <ProgressBadge progress={progress} />
        ) : null}
      </div>
    </Link>
  );
}
