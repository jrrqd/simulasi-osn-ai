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
import { getIoaiYearPack } from "@/lib/content/ioai-year-packs";

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
  assert.equal(meta.ioaiYear, 2026);
  assert.equal(slots.length, 5);
  for (const slot of slots) {
    assert.ok(slot.difficulty === 4 || slot.difficulty === 5);
    assert.equal(slot.answerType, "notebook_submission");
    assert.ok(slot.sourceResourceId, "year pack pins sourceResourceId");
    assert.ok(slot.scoringMetric);
  }
});

test("buildAiMockPlan kaggle-300 ioaiYear 2025 matches year pack topics", () => {
  const pack = getIoaiYearPack(2025);
  const { slots, meta } = buildAiMockPlan({
    generationMode: "standard",
    track: "B",
    difficultyMode: "normal",
    size: "kaggle-300",
    ioaiYear: 2025,
    phase: "final",
  });
  assert.equal(meta.ioaiYear, 2025);
  assert.match(meta.title, /\(IOAI 2025\)/);
  assert.ok(meta.description.includes("(IOAI 2025)"));
  assert.equal(slots.length, 5);
  for (let i = 0; i < 5; i++) {
    assert.equal(slots[i]!.sourceResourceId, pack[i]!.resourceId);
    assert.equal(slots[i]!.topic, pack[i]!.topic);
    assert.equal(slots[i]!.track, pack[i]!.track);
  }
});

test("buildAiMockPlan kaggle-150 year pack uses 3 papers", () => {
  const pack = getIoaiYearPack(2025, 3);
  const { slots, meta } = buildAiMockPlan({
    generationMode: "standard",
    track: "B",
    difficultyMode: "normal",
    size: "kaggle-150",
    ioaiYear: 2025,
    phase: "pre-seleksi",
  });
  assert.equal(meta.ioaiYear, 2025);
  assert.equal(meta.difficultyMode, "final");
  assert.equal(meta.examFormat, "kaggle");
  assert.equal(meta.questionCount, 3);
  assert.equal(meta.durationMinutes, 150);
  assert.match(meta.title, /\(IOAI 2025\)/);
  assert.equal(slots.length, 3);
  for (let i = 0; i < 3; i++) {
    assert.equal(slots[i]!.sourceResourceId, pack[i]!.resourceId);
    assert.equal(slots[i]!.answerType, "notebook_submission");
  }
});
