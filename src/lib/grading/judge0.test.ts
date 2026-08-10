import assert from "node:assert/strict";
import test from "node:test";
import type { CodeSpec } from "@/lib/content/types";
import { gradeCodeWithJudge0 } from "@/lib/grading/judge0";

const codeSpec: CodeSpec = {
  skeleton: "def predict(x):\n    # >>> WRITE HERE <<<\n    return x\n    # <<< END <<<\n\nprint(predict(int(input())))",
  testCases: [
    { input: "1\n", expectedOutput: "1\n", weight: 1 },
    { input: "2\n", expectedOutput: "9\n", weight: 2 },
  ],
  timeLimitMs: 2000,
  memoryLimitMb: 256,
};

test("Judge0 grading returns aggregate-only feedback", async () => {
  const requests: unknown[] = [];
  const result = await gradeCodeWithJudge0({
    codeSpec,
    userCode: codeSpec.skeleton,
    fetchImpl: async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({
          submissions: [
            { stdout: "1\n", status: { id: 3, description: "Accepted" } },
            { stdout: "2\n", status: { id: 3, description: "Accepted" } },
          ],
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    },
    config: {
      baseUrl: "http://judge0.internal",
      languageId: 71,
      apiKey: "secret",
      apiHost: "judge0.internal",
    },
  });

  assert.equal(requests.length, 1);
  assert.deepEqual(result, {
    passedCount: 1,
    totalCount: 2,
    passedWeight: 1,
    totalWeight: 3,
    timedOut: false,
    memoryExceeded: false,
    skeletonViolated: false,
  });
  assert.equal(JSON.stringify(result).includes("expectedOutput"), false);
  assert.equal(JSON.stringify(result).includes('"stdout"'), false);
});

test("Judge0 grading polls token-based batch submissions", async () => {
  const urls: string[] = [];
  const result = await gradeCodeWithJudge0({
    codeSpec,
    userCode: codeSpec.skeleton,
    fetchImpl: async (input) => {
      const url = String(input);
      urls.push(url);
      if (urls.length === 1) {
        return new Response(
          JSON.stringify([{ token: "a" }, { token: "b" }]),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          submissions: [
            { stdout: "1\n", status: { id: 3, description: "Accepted" } },
            { stdout: "9\n", status: { id: 3, description: "Accepted" } },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
    config: { baseUrl: "http://judge0.internal", languageId: 71 },
  });

  assert.equal(urls.length, 2);
  assert.match(urls[1]!, /submissions\/batch\?tokens=a%2Cb/);
  assert.equal(result.passedCount, 2);
  assert.equal(result.passedWeight, 3);
});

test("Judge0 grading rejects changes outside WRITE HERE", async () => {
  let called = false;
  const result = await gradeCodeWithJudge0({
    codeSpec,
    userCode: codeSpec.skeleton.replace("def predict(x):", "def hacked(x):"),
    fetchImpl: async () => {
      called = true;
      throw new Error("must not run");
    },
    config: {
      baseUrl: "http://judge0.internal",
      languageId: 71,
    },
  });

  assert.equal(called, false);
  assert.equal(result.skeletonViolated, true);
  assert.equal(result.passedCount, 0);
  assert.equal(result.totalCount, 2);
});
