import assert from "node:assert/strict";
import test from "node:test";
import { canAccessIoaiResources } from "@/lib/user/load-phase";

test("IOAI knowledge gate allows semifinal/final and admins", () => {
  assert.equal(canAccessIoaiResources("semifinal"), true);
  assert.equal(canAccessIoaiResources("final"), true);
  assert.equal(canAccessIoaiResources("pre-seleksi", "admin"), true);
});

test("IOAI knowledge gate blocks pre-seleksi students", () => {
  assert.equal(canAccessIoaiResources("pre-seleksi"), false);
  assert.equal(canAccessIoaiResources("pre-seleksi", "student"), false);
});
