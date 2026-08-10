import assert from "node:assert/strict";
import test from "node:test";
import type { Problem } from "@/lib/content/types";
import { toExamFacingProblem } from "@/lib/content/exam-facing-problem";

const problem: Problem = {
  id: "coding-1",
  title: "Predict",
  track: "B",
  topic: "supervised-learning",
  difficulty: 3,
  answerType: "codeSpec",
  stem: "Implementasikan predict.",
  solution: "Rahasia",
  codeSpec: {
    skeleton: "def predict(x):\n    # >>> WRITE HERE <<<\n    return 0\n    # <<< END <<<",
    testCases: [
      { input: "1\n", expectedOutput: "1\n" },
      { input: "2\n", expectedOutput: "2\n" },
      { input: "3\n", expectedOutput: "3\n" },
    ],
    timeLimitMs: 2000,
    memoryLimitMb: 256,
  },
};

test("exam-facing coding problems never expose hidden test data", () => {
  const facing = toExamFacingProblem(problem);
  assert.ok(facing.codeSpec);
  assert.equal(facing.codeSpec.testCaseCount, 3);
  assert.equal("testCases" in facing.codeSpec, false);
  assert.equal(JSON.stringify(facing).includes("expectedOutput"), false);
  assert.equal(JSON.stringify(facing).includes('"input":"1'), false);
});
