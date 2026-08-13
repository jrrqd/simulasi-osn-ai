import assert from "node:assert/strict";
import test from "node:test";
import {
  DIFFICULTY_MODES,
  labelDifficultyMode,
  labelDifficultyModeBand,
  parseDifficultyMode,
  resolveDifficulty,
} from "@/lib/ai/difficulty";

test("parseDifficultyMode accepts final", () => {
  assert.equal(parseDifficultyMode("final"), "final");
  assert.equal(parseDifficultyMode("FINAL"), "medium"); // case-sensitive
});

test("DIFFICULTY_MODES includes Final (IOAI)", () => {
  assert.ok(DIFFICULTY_MODES.some((d) => d.value === "final"));
  assert.equal(labelDifficultyMode("final"), "Final (IOAI)");
  assert.equal(labelDifficultyModeBand("final"), "Final");
});

test("resolveDifficulty(final) is only D4 or D5", () => {
  for (let i = 0; i < 80; i++) {
    const d = resolveDifficulty("final");
    assert.ok(d === 4 || d === 5, `got ${d}`);
  }
});
