import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ACCESS_MATRIX,
  normalizeAccessMatrix,
} from "@/lib/access/catalog";

test("normalizeAccessMatrix locks admin_panel to admin only", () => {
  const matrix = normalizeAccessMatrix({
    free: { admin_panel: true, study: false },
    admin: { admin_panel: false },
  });
  assert.equal(matrix.free.admin_panel, false);
  assert.equal(matrix.free.study, false);
  assert.equal(matrix.admin.admin_panel, true);
  assert.equal(matrix.vip.bypass_simulasi_quota, true);
});

test("DEFAULT_ACCESS_MATRIX matches pre-matrix product rules", () => {
  assert.equal(DEFAULT_ACCESS_MATRIX.free.bypass_simulasi_quota, false);
  assert.equal(DEFAULT_ACCESS_MATRIX.vip.bypass_simulasi_quota, true);
  assert.equal(DEFAULT_ACCESS_MATRIX.test.bypass_rate_limits, true);
  assert.equal(DEFAULT_ACCESS_MATRIX.free.bypass_rate_limits, false);
  assert.equal(DEFAULT_ACCESS_MATRIX.admin.admin_panel, true);
  assert.equal(DEFAULT_ACCESS_MATRIX.free.ai_assistant, true);
  assert.equal(DEFAULT_ACCESS_MATRIX.vip.ai_assistant, true);
  assert.equal(DEFAULT_ACCESS_MATRIX.admin.ai_assistant, true);
});
