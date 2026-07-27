import type { Problem } from "@/lib/content/types";

/** Problem shape safe to send to the exam client (no keys/solutions). */
export type ExamFacingProblem = Omit<Problem, "answer" | "solution" | "parts"> & {
  parts?: Omit<NonNullable<Problem["parts"]>[number], "answer">[];
};

export function toExamFacingProblem(problem: Problem): ExamFacingProblem {
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
