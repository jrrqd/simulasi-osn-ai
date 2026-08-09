import type { Problem } from "@/lib/content/types";
import { resolveNumericFormat } from "@/lib/content/types";

/** Problem shape safe to send to the exam client (no keys/solutions). */
export type ExamFacingProblem = Omit<
  Problem,
  "answer" | "solution" | "parts"
> & {
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
          ...problem.codeSpec,
          // Hide expected outputs from exam client? Keep them for in-exam
          // self-check against sample cases — OSN practice shows sample tests.
          // Full hidden tests would strip expectedOutput; for simulation we keep.
          testCases: problem.codeSpec.testCases,
        }
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
