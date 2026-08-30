import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFinalEkkaPromptBlock,
  slotAnswerTypeRotation,
  slotNeedsLongFormCoding,
} from "@/lib/ai/final-ekka-generation";

test("slotNeedsLongFormCoding only for notebook_submission", () => {
  assert.equal(slotNeedsLongFormCoding("notebook_submission"), true);
  assert.equal(slotNeedsLongFormCoding("codeSpec"), false);
  assert.equal(slotNeedsLongFormCoding("numeric"), false);
});

test("slotAnswerTypeRotation keeps notebook family on retries", () => {
  assert.deepEqual(slotAnswerTypeRotation("notebook_submission", false), [
    "notebook_submission",
    "notebook_submission",
    "notebook_submission",
  ]);
  assert.deepEqual(slotAnswerTypeRotation("numeric", true), [
    "notebook_submission",
    "notebook_submission",
    "notebook_submission",
  ]);
});

test("slotAnswerTypeRotation keeps codeSpec family on retries", () => {
  assert.deepEqual(slotAnswerTypeRotation("codeSpec", false), [
    "codeSpec",
    "codeSpec",
    "codeSpec",
  ]);
});

test("slotAnswerTypeRotation for short-fill still allows soft fallbacks", () => {
  assert.deepEqual(slotAnswerTypeRotation("mcq", false), [
    "mcq",
    "numeric",
    "mcq",
    "short_string",
    "codeSpec",
  ]);
});

test("buildFinalEkkaPromptBlock day-1 mentions problem solving", () => {
  const block = buildFinalEkkaPromptBlock({
    profile: "final-day-1",
    answerType: "numeric",
  });
  assert.match(block, /Problem Solving/);
  assert.match(block, /final-day-1/);
  assert.doesNotMatch(block, /notebook \+ CSV/);
});

test("buildFinalEkkaPromptBlock day-2 distinguishes code vs notebook", () => {
  const code = buildFinalEkkaPromptBlock({
    profile: "final-day-2",
    answerType: "codeSpec",
  });
  const notebook = buildFinalEkkaPromptBlock({
    profile: "final-day-2",
    answerType: "notebook_submission",
  });
  assert.match(code, /codeSpec/);
  assert.match(notebook, /CSV/);
  assert.match(code, /final-day-2/);
  assert.match(notebook, /final-day-2/);
});
