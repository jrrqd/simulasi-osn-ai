import assert from "node:assert/strict";
import test from "node:test";
import {
  aiMockSizeMeta,
  buildAiMockPlan,
  isFinalKaggleSize,
  isKaggleSize,
  parseAiMockSize,
  resolveGenerationPhase,
} from "@/lib/ai/ai-mock-plan";
import { isIoaiSyllabusTopic } from "@/lib/content/ioai-syllabus";

test("parseAiMockSize accepts kaggle-300", () => {
  assert.equal(parseAiMockSize("kaggle-300"), "kaggle-300");
  assert.ok(isKaggleSize("kaggle-300"));
  assert.ok(isFinalKaggleSize("kaggle-300"));
  assert.equal(isFinalKaggleSize("kaggle-150"), false);
});

test("kaggle-300 meta is 5 comps · 300 min", () => {
  const meta = aiMockSizeMeta("kaggle-300");
  assert.equal(meta.count, 5);
  assert.equal(meta.durationMinutes, 300);
});

test("resolveGenerationPhase(final) always returns final", () => {
  assert.equal(
    resolveGenerationPhase("pre-seleksi", "final", false),
    "final",
  );
  assert.equal(resolveGenerationPhase("semifinal", "final", true), "final");
});

test("buildAiMockPlan kaggle-300 forces final + 5 IOAI slots", () => {
  const { slots, meta } = buildAiMockPlan({
    generationMode: "standard",
    track: "B",
    difficultyMode: "normal",
    size: "kaggle-300",
    phase: "pre-seleksi",
  });
  assert.equal(meta.difficultyMode, "final");
  assert.equal(meta.examFormat, "kaggle");
  assert.equal(meta.questionCount, 5);
  assert.equal(meta.durationMinutes, 300);
  assert.equal(slots.length, 5);
  for (const slot of slots) {
    assert.ok(slot.difficulty === 4 || slot.difficulty === 5);
    assert.equal(slot.answerType, "notebook_submission");
    assert.ok(isIoaiSyllabusTopic(slot.topic), slot.topic);
    assert.ok(slot.scoringMetric);
  }
});
