import { ExternalLink } from "lucide-react";
import {
  getIoaiResourcesForPhase,
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

  const competitions = resources.filter((r) => r.category !== "course");
  const courses = resources.filter((r) => r.category === "course");

  return (
    <section className="panel space-y-3 rounded-3xl p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          Referensi IOAI
        </p>
        <h2 className="display text-2xl">Persiapan olimpiade internasional</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Tautan terbuka dari Education Hub &amp; seleksi nasional — inspirasi
          gaya soal (bukan salinan). Fase {phase === "final" ? "final" : "semifinal"}.
        </p>
      </div>

      {competitions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Soal kompetisi
          </p>
          <ul className="space-y-2">
            {competitions.map((r) => (
              <li key={r.id}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start justify-between gap-3 rounded-2xl bg-white/60 px-3 py-2.5 transition hover:bg-white/90"
                >
                  <div className="min-w-0">
                    <p className="font-medium leading-snug group-hover:text-[var(--accent)]">
                      {r.title}
                    </p>
                    {badge(r) ? (
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {badge(r)}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                      {r.summary}
                    </p>
                  </div>
                  <ExternalLink
                    size={16}
                    className="mt-1 shrink-0 opacity-50 group-hover:opacity-100"
                    aria-hidden
                  />
                </a>
              </li>
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
              <li key={r.id}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start justify-between gap-3 rounded-2xl bg-white/60 px-3 py-2.5 transition hover:bg-white/90"
                >
                  <div className="min-w-0">
                    <p className="font-medium leading-snug group-hover:text-[var(--accent)]">
                      {r.title}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                      {r.summary}
                    </p>
                  </div>
                  <ExternalLink
                    size={16}
                    className="mt-1 shrink-0 opacity-50 group-hover:opacity-100"
                    aria-hidden
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
