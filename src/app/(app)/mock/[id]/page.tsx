import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  resolveMock,
  resolveProblemsForMock,
} from "@/lib/content/shared";
import { toExamFacingProblem } from "@/lib/content/exam-facing-problem";
import { displayMockTitle } from "@/lib/ai/mock-title";
import { MockExamClient } from "@/components/mock-exam-client";

export default async function MockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const mock = await resolveMock(id);
  if (!mock) notFound();
  const problems = await resolveProblemsForMock(id);
  if (problems.length === 0) notFound();

  return (
    <MockExamClient
      mockId={mock.id}
      title={displayMockTitle(mock)}
      durationMinutes={mock.durationMinutes}
      problems={problems.map(toExamFacingProblem)}
      penaltyEnabled={mock.penaltyEnabled !== false}
      penaltyMinutesPerWrong={mock.penaltyMinutesPerWrong ?? 20}
    />
  );
}
