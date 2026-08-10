import type { UserAccess } from "@/lib/user/user-type";

export type AiSettingsSource = "personal" | "admin" | "default" | null;

export type EffectiveAiSource = {
  source: AiSettingsSource;
};

/** Admin and test accounts skip in-memory abuse rate limits. */
export function shouldBypassRateLimits(access: UserAccess): boolean {
  return access.isAdmin || access.userType === "test";
}

/**
 * Simulasi daily quota does not apply to admins, test, VIP,
 * or anyone using a verified personal (BYOK) key.
 */
export function shouldBypassSimulasiQuota(
  access: UserAccess,
  settings: EffectiveAiSource | null | undefined,
): boolean {
  if (access.isAdmin) return true;
  if (access.userType === "test" || access.userType === "vip") return true;
  if (settings?.source === "personal" || access.personalReady) return true;
  return false;
}

export function isSimulasiQuotaGated(
  access: UserAccess,
  settings: EffectiveAiSource | null | undefined,
): boolean {
  return !shouldBypassSimulasiQuota(access, settings);
}
