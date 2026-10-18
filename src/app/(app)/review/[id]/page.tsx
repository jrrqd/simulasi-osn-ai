import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { Markdown } from "@/components/markdown";
import { ReviewChat } from "@/components/review-chat";
import { ReviewAiFallback } from "@/components/review-ai-fallback";
import { resolveProblem } from "@/lib/content/shared";
import { isProblemAnswerLocked } from "@/lib/content/answer-lock";
import { toExamFacingProblem } from "@/lib/content/exam-facing-problem";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  await searchParams;
  const problem = await resolveProblem(id);

  if (!problem) {
    return <ReviewAiFallback id={id} />;
  }

  const isAdmin = user.role === "admin";
  const locked =
    !isAdmin && (await isProblemAnswerLocked(user.id, problem.id));

  let hasAttempt = isAdmin;
  if (!isAdmin && !locked) {
    const db = await getDb();
    const row = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.userId, user.id), eq(attempts.problemId, problem.id)))
      .limit(1);
    hasAttempt = row.length > 0;
  }

  const canRevealKeys = isAdmin || (!locked && hasAttempt);
  const examFacing = toExamFacingProblem(problem);
  const isCompetition =
    problem.answerType === "notebook_submission" &&
    Boolean(problem.competitionSpec);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h1 className="display text-3xl">Review · {problem.title}</h1>
        <div className="panel rounded-3xl p-5">
          <Markdown content={examFacing.stem} />
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
          {canRevealKeys ? (
            <>
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
            </>
          ) : locked ? (
            <div className="space-y-3 text-sm text-[var(--muted)]">
              <p>
                Kunci jawaban masih terkunci karena soal ini ada di simulasi
                yang belum kamu kumpulkan.
              </p>
              <Link href="/mock" className="btn btn-secondary inline-flex">
                Buka Simulasi
              </Link>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-[var(--muted)]">
              <p>
                Kerjakan soal ini dulu di Latihan agar pembahasan dan kunci
                jawaban terbuka.
              </p>
              <Link
                href={`/practice/${problem.id}`}
                className="btn btn-secondary inline-flex"
              >
                Kerjakan di Latihan
              </Link>
            </div>
          )}
        </div>
      </div>
      {canRevealKeys ? (
        <ReviewChat problemId={problem.id} />
      ) : (
        <div className="panel rounded-3xl p-5 text-sm text-[var(--muted)]">
          Asisten review tersedia setelah kunci jawaban terbuka.
        </div>
      )}
    </div>
  );
}
