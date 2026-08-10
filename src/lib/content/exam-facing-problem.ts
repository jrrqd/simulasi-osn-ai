import type {
  ClientCodeSpec,
  ClientCompetitionSpec,
  Problem,
} from "@/lib/content/types";
import { resolveNumericFormat } from "@/lib/content/types";
import { toClientCompetitionSpec } from "@/lib/competition/competition-spec";

/** Problem shape safe to send to student clients (no keys, solutions, or tests). */
export type ExamFacingProblem = Omit<
  Problem,
  "answer" | "solution" | "parts" | "codeSpec" | "competitionSpec"
> & {
  codeSpec?: ClientCodeSpec;
  competitionSpec?: ClientCompetitionSpec;
  parts?: Omit<NonNullable<Problem["parts"]>[number], "answer">[];
};

export function toExamFacingProblem(problem: Problem): ExamFacingProblem {
  const numericFormat = resolveNumericFormat(problem);
  return {
    id: problem.id,
    title: problem.title,
    track: problem.track,
    topic: problem.topic,
    difficulty: problem.difficulty,
    answerType: problem.answerType,
    stem: problem.stem,
    tolerance: problem.tolerance,
    choices: problem.choices,
    tags: problem.tags,
    source: problem.source,
    starterCode: problem.starterCode,
    figures: problem.figures,
    images: problem.images,
    numericFormat,
    expectedFormat: problem.expectedFormat ?? numericFormat,
    numericPartCount: problem.numericPartCount,
    weight: problem.weight,
    codeSpec: problem.codeSpec
      ? {
          skeleton: problem.codeSpec.skeleton,
          lockedMarkers: problem.codeSpec.lockedMarkers,
          lockedRanges: problem.codeSpec.lockedRanges,
          timeLimitMs: problem.codeSpec.timeLimitMs,
          memoryLimitMb: problem.codeSpec.memoryLimitMb,
          forbiddenImports: problem.codeSpec.forbiddenImports,
          testCaseCount: problem.codeSpec.testCases.length,
        }
      : undefined,
    competitionSpec: problem.competitionSpec
      ? toClientCompetitionSpec(problem.competitionSpec)
      : undefined,
    legacy: problem.legacy,
    parts: problem.parts?.map((part) => ({
      id: part.id,
      prompt: part.prompt,
      answerType: part.answerType,
      tolerance: part.tolerance,
      choices: part.choices,
      points: part.points,
    })),
  };
}
