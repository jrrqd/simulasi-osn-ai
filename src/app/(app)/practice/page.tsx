import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getLessons, getProblems } from "@/lib/content/load";
import { listSharedProblems } from "@/lib/content/shared";
import { TOPIC_LABELS } from "@/lib/content/types";
import { getUserProblemProgress } from "@/lib/attempts";
import { GenerateChallenge } from "@/components/generate-challenge";
import { PracticeProblemCard } from "@/components/practice-problem-card";

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; topic?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  let problems = getProblems();
  if (sp.track) problems = problems.filter((p) => p.track === sp.track);
  if (sp.topic) problems = problems.filter((p) => p.topic === sp.topic);

  const shared = await listSharedProblems({
    track: sp.track,
    topic: sp.topic,
    limit: 40,
  });

  const problemIds = [
    ...new Set([...problems.map((p) => p.id), ...shared.map((p) => p.id)]),
  ];
  const progressById = await getUserProblemProgress(user.id, problemIds);
  const doneScores = problemIds
    .map((id) => progressById.get(id))
    .filter((p): p is NonNullable<typeof p> => (p?.attemptCount ?? 0) > 0)
    .map((p) => p.bestScore);
  const doneCount = doneScores.length;
  const avgBestPct =
    doneCount > 0
      ? Math.round(
          (doneScores.reduce((sum, s) => sum + s, 0) / doneCount) * 100,
        )
      : 0;

  const linkedLesson = sp.topic
    ? getLessons().find(
        (l) =>
          l.topic === sp.topic && (!sp.track || l.track === sp.track),
      )
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl">Latihan</h1>
        <p className="text-[var(--muted)]">
          Side quests — bank soal curated + bank AI bersama untuk memperkuat
          level tutorial.
        </p>
        {problemIds.length > 0 ? (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Progressmu: {doneCount}/{problemIds.length} quest dikerjakan
            {doneCount > 0
              ? ` · rata-rata skor terbaik ${avgBestPct}%`
              : ""}
          </p>
        ) : null}
      </div>

      {linkedLesson ? (
        <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Side quests untuk level
            </p>
            <p className="font-medium">{linkedLesson.title}</p>
            <p className="text-sm text-[var(--muted)]">
              Track {linkedLesson.track} ·{" "}
              {TOPIC_LABELS[linkedLesson.topic] ?? linkedLesson.topic}
            </p>
          </div>
          <Link
            href={`/study/${linkedLesson.id}`}
            className="btn btn-secondary !py-1.5 text-sm"
          >
            Kembali ke tutorial
          </Link>
        </div>
      ) : null}

      <GenerateChallenge />
      <div className="flex flex-wrap gap-2 text-sm">
        {["", "A", "B", "C", "D"].map((t) => (
          <Link
            key={t || "all"}
            href={
              t
                ? `/practice?track=${t}${sp.topic ? `&topic=${encodeURIComponent(sp.topic)}` : ""}`
                : sp.topic
                  ? `/practice?topic=${encodeURIComponent(sp.topic)}`
                  : "/practice"
            }
            className="rounded-full bg-white/70 px-3 py-1"
          >
            {t || "Semua"}
          </Link>
        ))}
      </div>

      {shared.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="display text-2xl">Bank soal AI bersama</h2>
            <p className="text-sm text-[var(--muted)]">
              Dihasilkan siswa lain (atau kamu) dan bisa dikerjakan siapa saja.
            </p>
          </div>
          <div className="grid gap-3">
            {shared.map((p) => (
              <PracticeProblemCard
                key={p.id}
                id={p.id}
                title={p.title}
                meta={`AI · ${p.track} · ${TOPIC_LABELS[p.topic] ?? p.topic}${
                  p.creatorName ? ` · ${p.creatorName}` : ""
                }`}
                difficulty={p.difficulty}
                progress={progressById.get(p.id)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="display text-2xl">Bank curated</h2>
        <div className="grid gap-3">
          {problems.map((p) => (
            <PracticeProblemCard
              key={p.id}
              id={p.id}
              title={p.title}
              meta={`${p.track} · ${TOPIC_LABELS[p.topic] ?? p.topic}`}
              difficulty={p.difficulty}
              progress={progressById.get(p.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
