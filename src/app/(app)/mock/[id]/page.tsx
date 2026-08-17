import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  resolveMock,
  resolveProblemsForMock,
} from "@/lib/content/shared";
import { toExamFacingProblem } from "@/lib/content/exam-facing-problem";
import { displayMockTitle } from "@/lib/ai/mock-title";
import { MockExamClient } from "@/components/mock-exam-client";
import { KaggleMockClient } from "@/components/kaggle-mock-client";
import { resolveExamIntegrityMode } from "@/lib/exam-integrity-policy";
import { loadUserPhase } from "@/lib/user/load-phase";

export default async function MockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const mock = await resolveMock(id);
  if (!mock) notFound();
  const problems = await resolveProblemsForMock(id);
  if (problems.length === 0) notFound();

  const userPhase = await loadUserPhase(user.id);
  const examFormat = mock.examFormat === "kaggle" ? "kaggle" : "standard";
  const integrityMode = resolveExamIntegrityMode({
    userPhase,
    examFormat,
  });

  const examFacing = problems.map(toExamFacingProblem);
  const title = displayMockTitle(mock);

  if (examFormat === "kaggle") {
    return (
      <KaggleMockClient
        mockId={mock.id}
        title={title}
        description={mock.description}
        durationMinutes={mock.durationMinutes}
        problems={examFacing}
        integrityMode={integrityMode}
        penaltyEnabled={mock.penaltyEnabled !== false}
        penaltyMinutesPerWrong={mock.penaltyMinutesPerWrong ?? 1}
      />
    );
  }

  return (
    <MockExamClient
      mockId={mock.id}
      title={title}
      durationMinutes={mock.durationMinutes}
      problems={examFacing}
      integrityMode={integrityMode}
      penaltyEnabled={mock.penaltyEnabled !== false}
      penaltyMinutesPerWrong={mock.penaltyMinutesPerWrong ?? 1}
    />
  );
}
