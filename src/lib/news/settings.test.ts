import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeNewsSchedule,
  isNewsRefreshDue,
  normalizeKeywords,
  normalizeIntervalHours,
  normalizeAnchorHourWib,
  normalizeAnchorWeekdayWib,
} from "@/lib/news/settings";

test("normalizeKeywords trims, lowercases, dedupes", () => {
  assert.deepEqual(normalizeKeywords(["  OSN AI ", "osn ai", "TOKI", ""]), [
    "osn ai",
    "toki",
  ]);
});

test("normalizeIntervalHours accepts weekly 168", () => {
  assert.equal(normalizeIntervalHours(6), 6);
  assert.equal(normalizeIntervalHours(168), 168);
  assert.equal(normalizeIntervalHours(3), 24);
});

test("normalizeAnchorHourWib clamps", () => {
  assert.equal(normalizeAnchorHourWib(6), 6);
  assert.equal(normalizeAnchorHourWib(-1), 0);
  assert.equal(normalizeAnchorHourWib(30), 23);
});

test("normalizeAnchorWeekdayWib clamps", () => {
  assert.equal(normalizeAnchorWeekdayWib(1), 1);
  assert.equal(normalizeAnchorWeekdayWib(-2), 0);
  assert.equal(normalizeAnchorWeekdayWib(9), 6);
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

test("isNewsRefreshDue weekly on matching weekday+hour", () => {
  // 2026-09-28 is Senin; 06:00 WIB = 2026-09-27 23:00 UTC
  const mondaySix = new Date("2026-09-27T23:00:00.000Z");
  assert.equal(
    isNewsRefreshDue({
      enabled: true,
      intervalHours: 168,
      anchorHourWib: 6,
      anchorWeekdayWib: 1,
      now: mondaySix,
    }),
    true,
  );
  // Same Monday but 07:00 WIB
  const mondaySeven = new Date("2026-09-28T00:00:00.000Z");
  assert.equal(
    isNewsRefreshDue({
      enabled: true,
      intervalHours: 168,
      anchorHourWib: 6,
      anchorWeekdayWib: 1,
      now: mondaySeven,
    }),
    false,
  );
  // Sunday 06:00 WIB
  const sundaySix = new Date("2026-09-26T23:00:00.000Z");
  assert.equal(
    isNewsRefreshDue({
      enabled: true,
      intervalHours: 168,
      anchorHourWib: 6,
      anchorWeekdayWib: 1,
      now: sundaySix,
    }),
    false,
  );
});

test("describeNewsSchedule", () => {
  assert.match(describeNewsSchedule(24, 6), /06:00/);
  assert.match(describeNewsSchedule(12, 6), /12 jam/);
  assert.match(describeNewsSchedule(168, 6, 1), /Senin/);
  assert.match(describeNewsSchedule(168, 6, 1), /minggu/);
});
