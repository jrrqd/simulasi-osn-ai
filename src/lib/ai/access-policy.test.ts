import assert from "node:assert/strict";
import test from "node:test";
import {
  isSimulasiQuotaGated,
  shouldBypassRateLimits,
  shouldBypassSimulasiQuota,
} from "@/lib/ai/access-policy";
import type { UserAccess } from "@/lib/user/user-type";

function access(
  partial: Partial<UserAccess> & Pick<UserAccess, "userType">,
): UserAccess {
  return {
    id: "u1",
    role: partial.isAdmin ? "admin" : "student",
    isAdmin: false,
    personalReady: false,
    ...partial,
  };
}

test("shouldBypassRateLimits: admin and test only", () => {
  assert.equal(shouldBypassRateLimits(access({ userType: "free" })), false);
  assert.equal(shouldBypassRateLimits(access({ userType: "vip" })), false);
  assert.equal(shouldBypassRateLimits(access({ userType: "test" })), true);
  assert.equal(
    shouldBypassRateLimits(access({ userType: "free", isAdmin: true })),
    true,
  );
});

test("shouldBypassSimulasiQuota: vip, test, admin, BYOK", () => {
  assert.equal(
    shouldBypassSimulasiQuota(access({ userType: "free" }), {
      source: "admin",
    }),
    false,
  );
  assert.equal(
    shouldBypassSimulasiQuota(access({ userType: "free" }), {
      source: "default",
    }),
    false,
  );
  assert.equal(
    shouldBypassSimulasiQuota(access({ userType: "free" }), {
      source: "personal",
    }),
    true,
  );
  assert.equal(
    shouldBypassSimulasiQuota(
      access({ userType: "free", personalReady: true }),
      { source: "admin" },
    ),
    true,
  );
  assert.equal(
    shouldBypassSimulasiQuota(access({ userType: "vip" }), { source: "admin" }),
    true,
  );
  assert.equal(
    shouldBypassSimulasiQuota(access({ userType: "test" }), {
      source: "admin",
    }),
    true,
  );
  assert.equal(
    shouldBypassSimulasiQuota(access({ userType: "free", isAdmin: true }), {
      source: "admin",
    }),
    true,
  );
});

test("isSimulasiQuotaGated is inverse of bypass", () => {
  const freeShared = access({ userType: "free" });
  assert.equal(isSimulasiQuotaGated(freeShared, { source: "admin" }), true);
  assert.equal(
    isSimulasiQuotaGated(access({ userType: "vip" }), { source: "admin" }),
    false,
  );
});
