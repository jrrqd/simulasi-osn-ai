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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h1 className="display text-3xl">Review · {problem.title}</h1>
        <div className="panel rounded-3xl p-5">
          <Markdown content={problem.stem} />
        </div>
        <div className="panel rounded-3xl p-5">
          <h2 className="display mb-2 text-xl">Solusi</h2>
          <Markdown content={problem.solution} />
          <p className="mt-3 text-sm text-[var(--muted)]">
            Jawaban: {JSON.stringify(problem.answer)}
          </p>
        </div>
      </div>
      <ReviewChat problemId={problem.id} />
    </div>
  );
}
