import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_IOAI_PACK_YEAR,
  getCatalogResource,
  getIoaiYearPack,
  IOAI_PACK_YEARS,
  IOAI_YEAR_PACK_IDS,
  parseIoaiPackYear,
} from "@/lib/content/ioai-year-packs";
import { getJsonIoaiFallback } from "@/lib/content/ioai-resources";
import { TRACKS, type TrackId } from "@/lib/content/types";

test("DEFAULT_IOAI_PACK_YEAR is 2026", () => {
  assert.equal(DEFAULT_IOAI_PACK_YEAR, 2026);
});

test("parseIoaiPackYear accepts 2024/2025/2026 and defaults otherwise", () => {
  assert.equal(parseIoaiPackYear(2025), 2025);
  assert.equal(parseIoaiPackYear("2024"), 2024);
  assert.equal(parseIoaiPackYear(2026), 2026);
  assert.equal(parseIoaiPackYear(undefined), DEFAULT_IOAI_PACK_YEAR);
  assert.equal(parseIoaiPackYear(1999), DEFAULT_IOAI_PACK_YEAR);
});

test("each year pack has exactly 5 catalog resource IDs that exist", () => {
  const catalogIds = new Set(getJsonIoaiFallback().map((r) => r.id));
  for (const year of IOAI_PACK_YEARS) {
    const ids = IOAI_YEAR_PACK_IDS[year];
    assert.equal(ids.length, 5, `${year} should have 5 ids`);
    for (const id of ids) {
      assert.ok(catalogIds.has(id), `missing catalog id ${id} for ${year}`);
      assert.ok(getCatalogResource(id), `getCatalogResource(${id})`);
    }
  }
});

test("getIoaiYearPack resolves track/topic for every slot", () => {
  for (const year of IOAI_PACK_YEARS) {
    const slots = getIoaiYearPack(year);
    assert.equal(slots.length, 5);
    for (const slot of slots) {
      assert.ok(TRACKS[slot.track as TrackId], slot.track);
      assert.ok(
        TRACKS[slot.track].topics.includes(slot.topic),
        `${slot.resourceId}: ${slot.topic} not on track ${slot.track}`,
      );
      assert.ok(slot.title.length > 0);
      assert.ok(slot.summary.length > 0);
      assert.equal(
        slot.practiceProblemId,
        `p-analog-${slot.resourceId}`,
      );
    }
  }
});

test("getIoaiYearPack(year, 3) returns first three papers", () => {
  const full = getIoaiYearPack(2025);
  const three = getIoaiYearPack(2025, 3);
  assert.equal(three.length, 3);
  assert.equal(three[0]!.resourceId, full[0]!.resourceId);
  assert.equal(three[2]!.resourceId, full[2]!.resourceId);
});
