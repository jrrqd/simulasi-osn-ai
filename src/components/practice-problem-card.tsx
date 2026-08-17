import Link from "next/link";
import { Check } from "lucide-react";
import type { ProblemProgress } from "@/lib/attempts";
import {
  difficultyBandTextClass,
  labelDifficultyBand,
} from "@/lib/ai/difficulty";

function scorePercent(score: number) {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

function ProgressBadge({ progress }: { progress?: ProblemProgress }) {
  if (!progress || progress.attemptCount === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2 py-0.5 text-xs text-[var(--muted)]">
        Belum dikerjakan
      </span>
    );
  }

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
          ? `Sudah dikerjakan ${progress.attemptCount}× · skor terakhir ${scorePercent(progress.lastScore)}%`
          : "Sudah dikerjakan"
      }
    >
      <Check size={12} strokeWidth={2.5} aria-hidden />
      Sudah dikerjakan · {pct}%
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
  difficulty,
  progress,
}: {
  id: string;
  title: string;
  meta: string;
  difficulty: number;
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
          <h3 className="display text-xl leading-snug">{title}</h3>
          <p className="text-xs text-[var(--muted)]">
            {meta}
            {" · "}
            <span
              className={`font-semibold ${difficultyBandTextClass(difficulty)}`}
            >
              {labelDifficultyBand(difficulty)}
            </span>
          </p>
        </div>
        <ProgressBadge progress={progress} />
      </div>
    </Link>
  );
}
