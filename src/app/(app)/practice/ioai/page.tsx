import { requireUser } from "@/lib/session";
import { getIoaiYearPack, parseIoaiPackYear } from "@/lib/content/ioai-year-packs";
import { getUserProblemProgress } from "@/lib/attempts";
import { IoaiPastPapersLatihan } from "@/components/ioai-past-papers-latihan";
import { IoaiResourcesPanel } from "@/components/ioai-resources-panel";
import { loadUserPhase } from "@/lib/user/load-phase";

export default async function PracticeIoaiPage({
  searchParams,
}: {
  searchParams: Promise<{
    track?: string;
    topic?: string;
    ioaiYear?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const phase = await loadUserPhase(user.id);
  const analogIds = getIoaiYearPack(
    parseIoaiPackYear(sp.ioaiYear ? Number(sp.ioaiYear) : undefined),
    5,
  ).map((s) => s.practiceProblemId);
  const progressById = await getUserProblemProgress(user.id, analogIds);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl">Arsip IOAI</h1>
        <p className="text-[var(--muted)]">
          Latihan Kaggle-style analog paper resmi di platform, plus tautan
          referensi terbuka.
        </p>
      </div>

      <IoaiPastPapersLatihan
        yearParam={sp.ioaiYear}
        track={sp.track}
        topic={sp.topic}
        progressById={progressById}
        basePath="/practice/ioai"
        hideIntro
      />

      <IoaiResourcesPanel
        phase={phase}
        track={sp.track}
        topic={sp.topic}
      />
    </div>
  );
}
