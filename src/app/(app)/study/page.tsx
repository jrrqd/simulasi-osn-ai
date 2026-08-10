import Link from "next/link";
import { Check } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getLessons } from "@/lib/content/load";
import { TRACKS } from "@/lib/content/types";
import { getUserLessonProgress } from "@/lib/lesson-progress";
import { IoaiResourcesPanel } from "@/components/ioai-resources-panel";
import { loadUserPhase } from "@/lib/user/phase";

export default async function StudyPage() {
  const user = await requireUser();
  const lessons = getLessons();
  const progressMap = await getUserLessonProgress(user.id);
  const phase = await loadUserPhase(user.id);

  const totalLevels = lessons.length;
  const completedLevels = lessons.filter(
    (l) => progressMap.get(l.id)?.status === "completed",
  ).length;
  const overallPct =
    totalLevels === 0 ? 0 : Math.round((completedLevels / totalLevels) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl">Belajar</h1>
        <p className="text-[var(--muted)]">
          Tutorial EKKA 2026 — selesaikan level per track. Tiap modul punya cek
          konsep multi-format (numeric / singkat / MCQ) + spaced repetition.
          Latihan soal jadi side quest setelah tiap modul.
        </p>
        <div className="mt-4 max-w-md">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">
              {completedLevels}/{totalLevels} level selesai
            </span>
            <span className="text-[var(--muted)]">{overallPct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(TRACKS).map(([id, meta]) => {
          const trackLessons = lessons.filter((l) => l.track === id);
          const done = trackLessons.filter(
            (l) => progressMap.get(l.id)?.status === "completed",
          ).length;
          const pct =
            trackLessons.length === 0
              ? 0
              : Math.round((done / trackLessons.length) * 100);

          return (
            <div key={id} className="panel rounded-3xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                    Tutorial chapter
                  </p>
                  <h2 className="display text-2xl">
                    {id}. {meta.name}
                  </h2>
                </div>
                <span className="text-sm text-[var(--muted)]">
                  {done}/{trackLessons.length} level
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">{meta.description}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <ul className="mt-4 space-y-2">
                {trackLessons.map((l, index) => {
                  const completed =
                    progressMap.get(l.id)?.status === "completed";
                  return (
                    <li key={l.id}>
                      <Link
                        href={`/study/${l.id}`}
                        className="flex items-start gap-3 rounded-2xl px-2 py-1.5 hover:bg-black/[0.03]"
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] ${
                            completed
                              ? "border-[rgba(31,122,76,0.35)] bg-[rgba(31,122,76,0.14)] text-[var(--ok)]"
                              : "border-[var(--line)] text-[var(--muted)]"
                          }`}
                          aria-hidden
                        >
                          {completed ? (
                            <Check size={12} strokeWidth={2.5} />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[var(--accent)]">
                            Level {index + 1}: {l.title}
                          </span>
                          <span className="text-xs text-[var(--muted)]">
                            {completed ? "Selesai" : "Belum"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <IoaiResourcesPanel phase={phase} />
    </div>
  );
}
