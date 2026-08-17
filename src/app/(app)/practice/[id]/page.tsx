import { requireUser } from "@/lib/session";
import { ProblemSolver } from "@/components/problem-solver";
import { AiProblemLoader } from "@/components/ai-problem-loader";
import { PracticeCompetitionClient } from "@/components/practice-competition-client";
import { resolveProblem } from "@/lib/content/shared";
import { toExamFacingProblem } from "@/lib/content/exam-facing-problem";

export default async function PracticeProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const problem = await resolveProblem(id);

  if (!problem) {
    return <AiProblemLoader id={id} />;
  }

  const examFacing = toExamFacingProblem(problem);

  if (
    problem.answerType === "notebook_submission" &&
    problem.competitionSpec
  ) {
    return <PracticeCompetitionClient problem={examFacing} />;
  }

  return <ProblemSolver problem={examFacing} />;
}
