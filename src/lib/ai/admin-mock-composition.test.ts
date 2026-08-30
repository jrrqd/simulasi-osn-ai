import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCompositionLabel,
  previewMockComposition,
} from "@/lib/ai/admin-mock-composition";

test("previewMockComposition final-day-1 is 20 short-fill · 300 min", () => {
  const preview = previewMockComposition({ size: "final-day-1" });
  assert.equal(preview.total, 20);
  assert.equal(preview.durationMinutes, 300);
  assert.equal(preview.notebookCount, 0);
  assert.equal(preview.slots.length, 20);
  assert.ok(preview.slots.every((s) => s.answerType !== "notebook_submission"));
  assert.match(formatCompositionLabel(preview), /300 menit/);
});

test("previewMockComposition final-day-2 is mixed coding + notebook", () => {
  const preview = previewMockComposition({ size: "final-day-2" });
  assert.equal(preview.total, 5);
  assert.equal(preview.durationMinutes, 300);
  assert.equal(preview.codingCount, 3);
  assert.equal(preview.notebookCount, 2);
  assert.equal(preview.totalWeight, 3 * 2 + 2 * 5);
  assert.match(formatCompositionLabel(preview), /notebook/);
});
