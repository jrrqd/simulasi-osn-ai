import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api";
import { getAiAvailability } from "@/lib/ai/settings";
import { getSimulasiQuota } from "@/lib/ai/simulasi-quota";
import { USER_TYPE_LABELS } from "@/lib/user/user-type";
import { loadUserAccess } from "@/lib/user/load-user-access";

export async function GET(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;

  const access = await loadUserAccess(authResult.user.id);
  if (!access) {
    return Response.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  const availability = await getAiAvailability(authResult.user.id);
  const quota = await getSimulasiQuota(
    authResult.user.id,
    access,
    { source: availability.effectiveSource },
  );

  return Response.json({
    userType: access.userType,
    userTypeLabel: access.isAdmin
      ? "Admin"
      : USER_TYPE_LABELS[access.userType],
    isAdmin: access.isAdmin,
    aiSource: availability.effectiveSource,
    personalReady: availability.personalReady,
    sharedAvailable: availability.sharedAvailable,
    simulasi: {
      used: quota.used,
      limit: quota.limit,
      remaining: quota.remaining,
      resetsAt: quota.resetsAt,
      gated: quota.gated,
    },
  });
}
