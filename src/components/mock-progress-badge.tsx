import { Check, Clock3 } from "lucide-react";
import type { MockProgress } from "@/lib/mock-progress";

function pct(ratio: number) {
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
}

export function MockProgressBadge({ progress }: { progress?: MockProgress }) {
  if (!progress || (progress.attemptCount === 0 && !progress.hasInProgress)) {
    return (
      <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2 py-0.5 text-xs text-[var(--muted)]">
        Belum dikerjakan
      </span>
    );
  }

  if (progress.hasInProgress && progress.attemptCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(161,92,7,0.12)] px-2 py-0.5 text-xs font-medium text-[var(--warn)]">
        <Clock3 size={12} strokeWidth={2.5} aria-hidden />
        Sedang dikerjakan
      </span>
    );
  }

  const last = progress.lastScoreRatio;
  const best = progress.bestScoreRatio;
  const showPct = last ?? best;
  const tone =
    showPct == null
      ? "bg-[rgba(15,110,86,0.12)] text-[var(--accent)]"
      : showPct >= 0.8
        ? "bg-[rgba(31,122,76,0.14)] text-[var(--ok)]"
        : showPct >= 0.5
          ? "bg-[rgba(161,92,7,0.12)] text-[var(--warn)]"
          : "bg-[rgba(180,35,24,0.1)] text-[var(--bad)]";

  const titleParts = [
    progress.hasInProgress ? "Ada sesi berjalan" : null,
    best != null && last != null && best !== last
      ? `Skor terbaik ${pct(best)}%`
      : null,
    progress.attemptCount > 1 ? `Dikerjakan ${progress.attemptCount}×` : null,
  ].filter(Boolean);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
      title={titleParts.join(" · ") || "Sudah dikerjakan"}
    >
      <Check size={12} strokeWidth={2.5} aria-hidden />
      {progress.hasInProgress ? "Lanjutkan" : "Selesai"}
      {showPct != null ? ` · ${pct(showPct)}%` : ""}
      {progress.attemptCount > 1 ? (
        <span className="opacity-70">· {progress.attemptCount}×</span>
      ) : null}
    </span>
  );
}

export function mockActionLabel(progress?: MockProgress) {
  if (!progress) return "Mulai";
  if (progress.hasInProgress) return "Lanjutkan";
  if (progress.attemptCount > 0) return "Ulangi";
  return "Mulai";
}
