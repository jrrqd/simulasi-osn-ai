import assert from "node:assert/strict";
import test from "node:test";
import {
  isUserType,
  parseUserType,
  USER_TYPE_LABELS,
  USER_TYPE_VALUES,
} from "@/lib/user/user-type";

test("USER_TYPE_VALUES covers free, vip, test", () => {
  assert.deepEqual([...USER_TYPE_VALUES], ["free", "vip", "test"]);
});

test("parseUserType defaults unknown to free", () => {
  assert.equal(parseUserType("vip"), "vip");
  assert.equal(parseUserType("free"), "free");
  assert.equal(parseUserType("test"), "test");
  assert.equal(parseUserType("admin"), "free");
  assert.equal(parseUserType(null), "free");
  assert.equal(parseUserType(undefined), "free");
});

test("isUserType rejects invalid values", () => {
  assert.equal(isUserType("vip"), true);
  assert.equal(isUserType("student"), false);
  assert.equal(isUserType(""), false);
});

test("USER_TYPE_LABELS are Indonesian", () => {
  assert.equal(USER_TYPE_LABELS.free, "Gratis");
  assert.equal(USER_TYPE_LABELS.vip, "VIP");
  assert.equal(USER_TYPE_LABELS.test, "Test");
});
