import assert from "node:assert/strict";
import test from "node:test";
import {
  aiMockSizeMeta,
  buildAiMockPlan,
  isFinalEkkaSize,
  isFinalKaggleSize,
  isKaggleSize,
  parseAiMockSize,
  resolveGenerationPhase,
} from "@/lib/ai/ai-mock-plan";
import {
  FINAL_EKKA_PRESETS,
  getFinalEkkaPreset,
  isFinalEkkaPresetId,
} from "@/lib/ai/final-ekka-presets";
import { isIoaiSyllabusTopic } from "@/lib/content/ioai-syllabus";
import { getIoaiYearPack } from "@/lib/content/ioai-year-packs";

test("parseAiMockSize accepts kaggle-300", () => {
  assert.equal(parseAiMockSize("kaggle-300"), "kaggle-300");
  assert.ok(isKaggleSize("kaggle-300"));
  assert.ok(isFinalKaggleSize("kaggle-300"));
  assert.equal(isFinalKaggleSize("kaggle-150"), false);
});

test("parseAiMockSize accepts final-day-1 and final-day-2", () => {
  assert.equal(parseAiMockSize("final-day-1"), "final-day-1");
  assert.equal(parseAiMockSize("final-day-2"), "final-day-2");
  assert.ok(isFinalEkkaSize("final-day-1"));
  assert.ok(isFinalEkkaSize("final-day-2"));
  assert.equal(isKaggleSize("final-day-1"), false);
  assert.equal(isFinalEkkaPresetId("final-day-1"), true);
});

test("kaggle-300 meta is 5 comps · 300 min", () => {
  const meta = aiMockSizeMeta("kaggle-300");
  assert.equal(meta.count, 5);
  assert.equal(meta.durationMinutes, 300);
});

test("final-day presets are 300 min with provisional counts", () => {
  const day1 = aiMockSizeMeta("final-day-1");
  const day2 = aiMockSizeMeta("final-day-2");
  assert.equal(day1.count, 20);
  assert.equal(day1.durationMinutes, 300);
  assert.equal(day2.count, 5);
  assert.equal(day2.durationMinutes, 300);
  assert.equal(getFinalEkkaPreset("final-day-1").examFormat, "standard");
  assert.equal(getFinalEkkaPreset("final-day-2").examFormat, "hybrid");
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

test("buildAiMockPlan final-day-1 is 20 short-fill · standard · final", () => {
  const preset = FINAL_EKKA_PRESETS["final-day-1"];
  const { slots, meta } = buildAiMockPlan({
    generationMode: "standard",
    track: "B",
    difficultyMode: "normal",
    size: "final-day-1",
    phase: "pre-seleksi",
  });
  assert.equal(meta.difficultyMode, "final");
  assert.equal(meta.examFormat, "standard");
  assert.equal(meta.finalEkkaProfile, "final-day-1");
  assert.equal(meta.questionCount, 20);
  assert.equal(meta.durationMinutes, 300);
  assert.match(meta.title, /Hari 1/);
  assert.ok(meta.description.includes("komposisi sementara"));
  assert.equal(slots.length, 20);
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    assert.ok(slot.difficulty === 4 || slot.difficulty === 5);
    assert.equal(slot.answerType, preset.slots[i]!.answerType);
    assert.notEqual(slot.answerType, "notebook_submission");
    assert.ok(isIoaiSyllabusTopic(slot.topic));
  }
});

test("buildAiMockPlan final-day-2 mixes 3 codeSpec + 2 notebook · hybrid", () => {
  const { slots, meta } = buildAiMockPlan({
    generationMode: "standard",
    track: "B",
    difficultyMode: "easy",
    size: "final-day-2",
    ioaiYear: 2025,
    phase: "final",
  });
  assert.equal(meta.difficultyMode, "final");
  assert.equal(meta.examFormat, "hybrid");
  assert.equal(meta.finalEkkaProfile, "final-day-2");
  assert.equal(meta.questionCount, 5);
  assert.equal(meta.durationMinutes, 300);
  assert.equal(meta.ioaiYear, 2025);
  assert.match(meta.title, /Hari 2/);
  assert.equal(slots.length, 5);

  const types = slots.map((s) => s.answerType);
  assert.deepEqual(types, [
    "codeSpec",
    "notebook_submission",
    "codeSpec",
    "notebook_submission",
    "codeSpec",
  ]);

  for (const slot of slots) {
    assert.ok(slot.difficulty === 4 || slot.difficulty === 5);
    if (slot.answerType === "notebook_submission") {
      assert.ok(slot.sourceResourceId);
      assert.ok(slot.scoringMetric);
      assert.equal(slot.weight, 5);
    } else {
      assert.equal(slot.answerType, "codeSpec");
      assert.equal(slot.weight, 2);
      assert.equal(slot.scoringMetric, undefined);
    }
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

test("quick/half/full presets still work after Final EKKA sizes", () => {
  const quick = buildAiMockPlan({
    generationMode: "standard",
    track: "B",
    difficultyMode: "normal",
    size: "quick",
  });
  assert.equal(quick.meta.examFormat, "standard");
  assert.equal(quick.meta.questionCount, 10);
  assert.equal(quick.meta.durationMinutes, 30);
  assert.equal(quick.meta.finalEkkaProfile, undefined);

  const full = buildAiMockPlan({
    generationMode: "standard",
    track: "ALL",
    difficultyMode: "semifinal",
    size: "full",
  });
  assert.equal(full.meta.questionCount, 40);
  assert.equal(full.meta.durationMinutes, 150);
  assert.equal(full.meta.examFormat, "standard");
});
