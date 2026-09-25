import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accessPolicies } from "@/db/schema";
import {
  ACCESS_TIERS,
  DEFAULT_ACCESS_MATRIX,
  normalizeAccessMatrix,
  type AccessFeatureFlags,
  type AccessFeatureId,
  type AccessMatrix,
  type AccessTier,
} from "@/lib/access/catalog";
import type { UserAccess } from "@/lib/user/user-type";

const globalForAccess = globalThis as typeof globalThis & {
  __osnaiAccessMatrixCache?: { matrix: AccessMatrix; at: number };
};

const CACHE_TTL_MS = 30_000;

export function tierForAccess(access: UserAccess): AccessTier {
  return access.isAdmin ? "admin" : access.userType;
}

export function invalidateAccessMatrixCache() {
  globalForAccess.__osnaiAccessMatrixCache = undefined;
}

export async function getAccessMatrix(): Promise<AccessMatrix> {
  const cached = globalForAccess.__osnaiAccessMatrixCache;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.matrix;
  }

  const db = await getDb();
  const rows = await db.query.accessPolicies.findMany();
  const raw: Partial<Record<AccessTier, AccessFeatureFlags>> = {};
  for (const row of rows) {
    const tier = row.tier as AccessTier;
    if (!ACCESS_TIERS.includes(tier)) continue;
    raw[tier] = row.features as AccessFeatureFlags;
  }
  const matrix = normalizeAccessMatrix(raw);
  globalForAccess.__osnaiAccessMatrixCache = {
    matrix,
    at: Date.now(),
  };
  return matrix;
}

export async function saveAccessMatrix(
  input: Partial<Record<AccessTier, Partial<AccessFeatureFlags>>>,
): Promise<AccessMatrix> {
  const matrix = normalizeAccessMatrix(input);
  const db = await getDb();
  const now = new Date();
  for (const tier of ACCESS_TIERS) {
    await db
      .insert(accessPolicies)
      .values({
        tier,
        features: matrix[tier],
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: accessPolicies.tier,
        set: {
          features: matrix[tier],
          updatedAt: now,
        },
      });
  }
  invalidateAccessMatrixCache();
  globalForAccess.__osnaiAccessMatrixCache = {
    matrix,
    at: Date.now(),
  };
  return matrix;
}

export function hasFeature(
  access: UserAccess,
  feature: AccessFeatureId,
  matrix: AccessMatrix = DEFAULT_ACCESS_MATRIX,
): boolean {
  return Boolean(matrix[tierForAccess(access)][feature]);
}

export async function userHasFeature(
  access: UserAccess,
  feature: AccessFeatureId,
): Promise<boolean> {
  return hasFeature(access, feature, await getAccessMatrix());
}
