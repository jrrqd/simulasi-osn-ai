import test from "node:test";
import assert from "node:assert/strict";
import {
  computeAccuracy,
  computeF1Macro,
  computeMae,
  computeRmse,
  errorToScore,
  gradeSubmissionCsv,
} from "@/lib/scoring/submission-metrics";

test("accuracy is proportional", () => {
  assert.equal(computeAccuracy(["a", "b", "a"], ["a", "b", "c"]), 2 / 3);
});

test("f1_macro perfect is 1", () => {
  assert.equal(computeF1Macro(["x", "y", "x"], ["x", "y", "x"]), 1);
});

test("rmse and mae convert to proportional score", () => {
  const rmse = computeRmse(["1", "2", "3"], ["1", "2", "3"]);
  assert.equal(rmse, 0);
  assert.equal(errorToScore(0), 1);
  const mae = computeMae(["2", "4"], ["1", "3"]);
  assert.equal(mae, 1);
  assert.ok(errorToScore(1!) < 1);
});

test("gradeSubmissionCsv aligns by id", () => {
  const result = gradeSubmissionCsv({
    submissionCsv: "id,prediction\n1,yes\n2,no\n3,yes\n",
    labelsCsv: "id,prediction\n1,yes\n2,yes\n3,yes\n",
    idColumn: "id",
    targetColumn: "prediction",
    mode: "accuracy",
  });
  assert.equal(result.rowCount, 3);
  assert.ok(Math.abs(result.score - 2 / 3) < 1e-9);
});

test("gradeSubmissionCsv rejects missing columns", () => {
  const result = gradeSubmissionCsv({
    submissionCsv: "id,foo\n1,a\n",
    labelsCsv: "id,prediction\n1,a\n",
    idColumn: "id",
    targetColumn: "prediction",
    mode: "accuracy",
  });
  assert.equal(result.score, 0);
  assert.ok(result.errors?.length);
});
