import assert from "node:assert/strict";
import test from "node:test";
import {
  FREE_SIMULASI_DAILY_LIMIT,
  nextDayAsiaJakarta,
  startOfDayAsiaJakarta,
} from "@/lib/ai/simulasi-quota";

test("FREE_SIMULASI_DAILY_LIMIT is 1", () => {
  assert.equal(FREE_SIMULASI_DAILY_LIMIT, 1);
});

test("startOfDayAsiaJakarta: midday WIB is same calendar day", () => {
  // 2026-08-10 12:00 WIB = 2026-08-10 05:00 UTC
  const noonWib = new Date("2026-08-10T05:00:00.000Z");
  const start = startOfDayAsiaJakarta(noonWib);
  assert.equal(start.toISOString(), "2026-08-09T17:00:00.000Z");
});

test("startOfDayAsiaJakarta: just after midnight WIB", () => {
  // 2026-08-10 00:30 WIB = 2026-08-09 17:30 UTC
  const early = new Date("2026-08-09T17:30:00.000Z");
  const start = startOfDayAsiaJakarta(early);
  assert.equal(start.toISOString(), "2026-08-09T17:00:00.000Z");
});

test("startOfDayAsiaJakarta: late evening before WIB midnight stays previous day", () => {
  // 2026-08-09 23:30 WIB = 2026-08-09 16:30 UTC
  const late = new Date("2026-08-09T16:30:00.000Z");
  const start = startOfDayAsiaJakarta(late);
  assert.equal(start.toISOString(), "2026-08-08T17:00:00.000Z");
});

test("nextDayAsiaJakarta is 24h after start of day", () => {
  const noonWib = new Date("2026-08-10T05:00:00.000Z");
  const next = nextDayAsiaJakarta(noonWib);
  assert.equal(next.toISOString(), "2026-08-10T17:00:00.000Z");
});
