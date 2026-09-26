import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeNewsSchedule,
  isNewsRefreshDue,
  normalizeKeywords,
  normalizeIntervalHours,
  normalizeAnchorHourWib,
} from "@/lib/news/settings";

test("normalizeKeywords trims, lowercases, dedupes", () => {
  assert.deepEqual(normalizeKeywords(["  OSN AI ", "osn ai", "TOKI", ""]), [
    "osn ai",
    "toki",
  ]);
});

test("normalizeIntervalHours falls back to 24", () => {
  assert.equal(normalizeIntervalHours(6), 6);
  assert.equal(normalizeIntervalHours(3), 24);
});

test("normalizeAnchorHourWib clamps", () => {
  assert.equal(normalizeAnchorHourWib(6), 6);
  assert.equal(normalizeAnchorHourWib(-1), 0);
  assert.equal(normalizeAnchorHourWib(30), 23);
});

test("isNewsRefreshDue daily at anchor", () => {
  // 2026-09-26 06:30 WIB = 2026-09-25 23:30 UTC
  const atSix = new Date("2026-09-25T23:30:00.000Z");
  assert.equal(
    isNewsRefreshDue({
      enabled: true,
      intervalHours: 24,
      anchorHourWib: 6,
      now: atSix,
    }),
    true,
  );
  const atSeven = new Date("2026-09-26T00:30:00.000Z");
  assert.equal(
    isNewsRefreshDue({
      enabled: true,
      intervalHours: 24,
      anchorHourWib: 6,
      now: atSeven,
    }),
    false,
  );
});

test("describeNewsSchedule", () => {
  assert.match(describeNewsSchedule(24, 6), /06:00/);
  assert.match(describeNewsSchedule(12, 6), /12 jam/);
});
