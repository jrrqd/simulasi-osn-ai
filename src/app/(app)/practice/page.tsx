import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getLessons } from "@/lib/content/load";
import { listSharedProblems } from "@/lib/content/shared";
import { listVisibleCuratedProblems } from "@/lib/content/problem-library";
import { TOPIC_LABELS } from "@/lib/content/types";
import { getUserProblemProgress } from "@/lib/attempts";
import { FilterChip } from "@/components/choice-chip";
import { PageHeader } from "@/components/page-header";
import { PracticeBankFilters } from "@/components/practice-bank-filters";

export default async function PracticeBankPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; topic?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const problems = await listVisibleCuratedProblems({
    track: sp.track,
    topic: sp.topic,
  });

  const shared = (
    await listSharedProblems({
      track: sp.track,
      topic: sp.topic,
      limit: 40,
    })
  ).filter((p) => p.answerType !== "notebook_submission");

  const curatedVisible = problems.filter(
    (p) => !(p.tags ?? []).includes("ioai-analog"),
  );

  const problemIds = [
    ...new Set([
      ...curatedVisible.map((p) => p.id),
      ...shared.map((p) => p.id),
    ]),
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

  const sharedItems = shared.map((p) => ({
    id: p.id,
    title: p.title,
    meta: `AI · ${p.track} · ${TOPIC_LABELS[p.topic] ?? p.topic}${
      p.creatorName ? ` · ${p.creatorName}` : ""
    }`,
    difficulty: p.difficulty,
    progress: progressById.get(p.id),
  }));

  const curatedItems = curatedVisible.map((p) => ({
    id: p.id,
    title: p.title,
    meta: `${p.track} · ${TOPIC_LABELS[p.topic] ?? p.topic}`,
    difficulty: p.difficulty,
    progress: progressById.get(p.id),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank soal"
        description="Side quests curated dan bank AI bersama."
      />

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

      <div className="flex flex-wrap gap-2">
        {["", "A", "B", "C", "D"].map((t) => (
          <FilterChip
            key={t || "all"}
            href={
              t
                ? `/practice?track=${t}${sp.topic ? `&topic=${encodeURIComponent(sp.topic)}` : ""}`
                : sp.topic
                  ? `/practice?topic=${encodeURIComponent(sp.topic)}`
                  : "/practice"
            }
            active={(sp.track ?? "") === t}
          >
            {t || "Semua"}
          </FilterChip>
        ))}
      </div>

      <PracticeBankFilters
        shared={sharedItems}
        curated={curatedItems}
        totalCount={problemIds.length}
        doneCount={doneCount}
        avgBestPct={avgBestPct}
      />
    </div>
  );
}
