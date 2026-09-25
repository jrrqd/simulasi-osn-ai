#!/usr/bin/env node
/**
 * Reset the admin password in production. Produces a hash in the exact
 * format Better Auth's @better-auth/utils hashPassword() emits:
 *   <hex-salt>:<hex-key>
 * where scrypt(N=16384, r=16, p=1, dkLen=64) is used.
 *
 * Usage: node scripts/reset-admin-password.mjs <email> <newPassword>
 *
 * The password is read from argv only — it is NOT echoed.
 */
import { scryptSync, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const [, , email, newPassword] = process.argv;
if (!email || !newPassword) {
  console.error(
    "usage: node scripts/reset-admin-password.mjs <email> <newPassword>",
  );
  process.exit(2);
}
if (newPassword.length < 8) {
  console.error("password must be at least 8 characters");
  process.exit(2);
}

const REMOTE = "ubuntu@43.134.182.44";
const DB = "osnai";

// NFKC-normalize to match Better Auth's verification path.
const normalized = newPassword.normalize("NFKC");
const salt = randomBytes(16).toString("hex");
const key = scryptSync(normalized, salt, 64, {
  N: 16384,
  r: 16,
  p: 1,
  maxmem: 128 * 16384 * 16 * 2,
}).toString("hex");
const hash = `${salt}:${key}`;

const userId = spawnSync(
  "ssh",
  [
    REMOTE,
    `sudo -u postgres psql ${DB} -tA -c "SELECT id FROM \\"user\\" WHERE email='${email}';"`,
  ],
  { encoding: "utf8" },
).stdout.trim();

if (!userId) {
  console.error(`no user with email ${email}`);
  process.exit(1);
}
console.log(`user id: ${userId}`);

const escaped = hash.replace(/'/g, "'\\''");
const result = spawnSync(
  "ssh",
  [
    REMOTE,
    `sudo -u postgres psql ${DB} -c "UPDATE account SET password='${escaped}' WHERE user_id='${userId}' AND provider_id='credential';"`,
  ],
  { encoding: "utf8", stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status);
console.log("password updated. Sign in at https://radr.nxtdev.xyz/login");
