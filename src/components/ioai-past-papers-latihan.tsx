import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  getCatalogResource,
  getIoaiYearPack,
  IOAI_PACK_YEARS,
  type IoaiPackYear,
  type IoaiYearPackSlot,
  parseIoaiPackYear,
} from "@/lib/content/ioai-year-packs";
import { TOPIC_LABELS } from "@/lib/content/types";
import type { ProblemProgress } from "@/lib/attempts";
import {
  difficultyBandTextClass,
  labelDifficultyBand,
} from "@/lib/ai/difficulty";

/**
 * Official IOAI year-pack archive for Latihan — in-app Kaggle analogs.
 * Official source link is secondary only.
 */
export function IoaiPastPapersLatihan({
  yearParam,
  track,
  topic,
  progressById,
  basePath = "/practice/ioai",
  hideIntro = false,
}: {
  yearParam?: string;
  track?: string;
  topic?: string;
  progressById?: Map<string, ProblemProgress>;
  /** Year-chip links target this path (default Arsip IOAI page). */
  basePath?: string;
  hideIntro?: boolean;
}) {
  const year: IoaiPackYear = parseIoaiPackYear(
    yearParam ? Number(yearParam) : undefined,
  );
  const slots = getIoaiYearPack(year, 5);

  const queryBase = new URLSearchParams();
  if (track) queryBase.set("track", track);
  if (topic) queryBase.set("topic", topic);

  return (
    <section className="space-y-3">
      {hideIntro ? null : (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Arsip paper IOAI
          </p>
          <h2 className="display text-2xl">Latihan Kaggle-style di platform</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Analog tabular dari paper resmi (bukan dataset/GPU asli). Kerjakan di
            Notebook + Submit CSV, lalu buka pembahasan. Simulasi berwaktu tetap
            di{" "}
            <Link href="/mock" className="underline underline-offset-2">
              Simulasi
            </Link>
            .
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        {IOAI_PACK_YEARS.map((y) => {
          const q = new URLSearchParams(queryBase);
          q.set("ioaiYear", String(y));
          return (
            <Link
              key={y}
              href={`${basePath}?${q.toString()}`}
              className={`rounded-full px-3 py-1 ${
                y === year
                  ? "bg-[var(--accent)] text-white"
                  : "bg-white/70 text-[var(--ink)]"
              }`}
            >
              IOAI {y}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3">
        {slots.map((slot) => (
          <IoaiPastPaperCard
            key={slot.resourceId}
            slot={slot}
            year={year}
            progress={progressById?.get(slot.practiceProblemId)}
          />
        ))}
      </div>
    </section>
  );
}

function scorePercent(score: number) {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

function IoaiPastPaperCard({
  slot,
  year,
  progress,
}: {
  slot: IoaiYearPackSlot;
  year: IoaiPackYear;
  progress?: ProblemProgress;
}) {
  const resource = getCatalogResource(slot.resourceId);
  const officialUrl = resource?.url;
  const done = Boolean(progress && progress.attemptCount > 0);
  const pct = done ? scorePercent(progress!.bestScore) : 0;

  return (
    <div
      className={`panel rounded-2xl p-4 ${
        done ? "border-[rgba(15,110,86,0.28)]" : ""
      }`}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
        Kaggle · IOAI {year}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold">{slot.title}</h3>
          <p className="text-xs text-[var(--muted)]">
            Track {slot.track} · {TOPIC_LABELS[slot.topic] ?? slot.topic}
            {" · "}
            <span className={`font-semibold ${difficultyBandTextClass(4)}`}>
              {labelDifficultyBand(4)}
            </span>
          </p>
          <p className="text-sm text-[var(--muted)]">{slot.summary}</p>
          {done ? (
            <p className="text-xs font-medium text-[var(--ok)]">
              Sudah dikerjakan · {pct}%
            </p>
          ) : (
            <p className="text-xs text-[var(--muted)]">Belum dikerjakan</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Link
            href={`/practice/${slot.practiceProblemId}`}
            className="btn btn-primary !px-3 !py-1.5 text-sm"
          >
            Kerjakan di platform
          </Link>
          {officialUrl ? (
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 text-xs text-[var(--muted)] underline-offset-2 hover:underline"
            >
              Sumber resmi
              <ExternalLink size={12} aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
