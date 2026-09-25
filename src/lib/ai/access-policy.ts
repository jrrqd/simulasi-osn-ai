import {
  DEFAULT_ACCESS_MATRIX,
  type AccessMatrix,
} from "@/lib/access/catalog";
import { hasFeature } from "@/lib/access/matrix";
import type { UserAccess } from "@/lib/user/user-type";

export type AiSettingsSource = "personal" | "admin" | "default" | null;

export type EffectiveAiSource = {
  source: AiSettingsSource;
};

/** Admin and test accounts skip in-memory abuse rate limits (matrix-driven). */
export function shouldBypassRateLimits(
  access: UserAccess,
  matrix: AccessMatrix = DEFAULT_ACCESS_MATRIX,
): boolean {
  return hasFeature(access, "bypass_rate_limits", matrix);
}

/**
 * Simulasi daily quota does not apply when the matrix grants
 * bypass_simulasi_quota, or when using a verified personal (BYOK) key.
 */
export function shouldBypassSimulasiQuota(
  access: UserAccess,
  settings: EffectiveAiSource | null | undefined,
  matrix: AccessMatrix = DEFAULT_ACCESS_MATRIX,
): boolean {
  if (hasFeature(access, "bypass_simulasi_quota", matrix)) return true;
  if (settings?.source === "personal" || access.personalReady) return true;
  return false;
}

export function isSimulasiQuotaGated(
  access: UserAccess,
  settings: EffectiveAiSource | null | undefined,
  matrix: AccessMatrix = DEFAULT_ACCESS_MATRIX,
): boolean {
  return !shouldBypassSimulasiQuota(access, settings, matrix);
}
