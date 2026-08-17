import { requireUser } from "@/lib/session";
import { Markdown } from "@/components/markdown";
import { ReviewChat } from "@/components/review-chat";
import { ReviewAiFallback } from "@/components/review-ai-fallback";
import { resolveProblem } from "@/lib/content/shared";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  await searchParams;
  const problem = await resolveProblem(id);

  if (!problem) {
    return <ReviewAiFallback id={id} />;
  }

  const isCompetition =
    problem.answerType === "notebook_submission" &&
    Boolean(problem.competitionSpec);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h1 className="display text-3xl">Review · {problem.title}</h1>
        <div className="panel rounded-3xl p-5">
          <Markdown content={problem.stem} />
        </div>
        {isCompetition && problem.competitionSpec?.overview ? (
          <div className="panel rounded-3xl p-5">
            <h2 className="display mb-2 text-xl">Overview kompetisi</h2>
            <Markdown content={problem.competitionSpec.overview} />
          </div>
        ) : null}
        <div className="panel rounded-3xl p-5">
          <h2 className="display mb-2 text-xl">
            {isCompetition ? "Pembahasan" : "Solusi"}
          </h2>
          <Markdown content={problem.solution} />
          {!isCompetition ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Jawaban: {JSON.stringify(problem.answer)}
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Penilaian lewat submission CSV (
              {problem.competitionSpec?.scoring.label ??
                problem.competitionSpec?.scoring.mode}
              ). Label tersembunyi tidak ditampilkan di sini.
            </p>
          )}
        </div>
      </div>
      <ReviewChat problemId={problem.id} />
    </div>
  );
}
