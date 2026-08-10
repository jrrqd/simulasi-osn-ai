import Link from "next/link";
import { BookOpen, ExternalLink } from "lucide-react";
import {
  getIoaiResourcesForPhase,
  listIoaiResourceRecords,
} from "@/lib/content/ioai-resources";
import type { TrackId } from "@/lib/content/types";
import type { Phase } from "@/lib/user/phase";
import type { IoaiResource } from "@/lib/content/resource-types";

function badge(resource: IoaiResource) {
  const parts = [resource.region, resource.year].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export async function IoaiResourcesPanel({
  phase,
  track,
  topic,
  limit = 6,
}: {
  phase: Phase;
  track?: TrackId | string;
  topic?: string;
  limit?: number;
}) {
  if (phase === "pre-seleksi") return null;

  const trackId =
    track === "A" || track === "B" || track === "C" || track === "D"
      ? track
      : undefined;

  const resources = await getIoaiResourcesForPhase(phase, {
    track: trackId,
    topic,
    limit,
    includeCourses: true,
  });

  if (resources.length === 0) return null;

  const records = await listIoaiResourceRecords();
  const guideByResource = new Map(
    records
      .filter((r) => r.guideId)
      .map((r) => [r.id, r.guideId!] as const),
  );

  const competitions = resources.filter((r) => r.category !== "course");
  const courses = resources.filter((r) => r.category === "course");

  function ResourceRow({ r }: { r: IoaiResource }) {
    const guideId = guideByResource.get(r.id);
    return (
      <li
        key={r.id}
        className="flex flex-col gap-2 rounded-2xl bg-white/60 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium leading-snug">{r.title}</p>
            {guideId ? (
              <span className="rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                Panduan ID
              </span>
            ) : null}
          </div>
          {badge(r) ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">{badge(r)}</p>
          ) : null}
          <p className="mt-0.5 text-sm text-[var(--muted)]">{r.summary}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {guideId ? (
            <Link
              href={`/resources/ioai/${guideId}`}
              className="btn btn-primary inline-flex items-center gap-1.5 !py-1.5 text-sm"
            >
              <BookOpen size={14} />
              Baca panduan (ID)
            </Link>
          ) : null}
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary inline-flex items-center gap-1.5 !py-1.5 text-sm"
          >
            <ExternalLink size={14} />
            {guideId ? "Soal asli" : "Buka"}
          </a>
        </div>
      </li>
    );
  }

  return (
    <section className="panel space-y-3 rounded-3xl p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          Referensi IOAI
        </p>
        <h2 className="display text-2xl">Persiapan olimpiade internasional</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Tautan terbuka dari Education Hub &amp; seleksi nasional — plus panduan
          Bahasa Indonesia bila tersedia. Fase{" "}
          {phase === "final" ? "final" : "semifinal"}.
        </p>
      </div>

      {competitions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Soal kompetisi
          </p>
          <ul className="space-y-2">
            {competitions.map((r) => (
              <ResourceRow key={r.id} r={r} />
            ))}
          </ul>
        </div>
      ) : null}

      {courses.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Materi belajar
          </p>
          <ul className="space-y-2">
            {courses.map((r) => (
              <ResourceRow key={r.id} r={r} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
