import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api";
import { getAiAssistantQuota } from "@/lib/ai/assistant-quota";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import { loadUserAccess } from "@/lib/user/load-user-access";
import { USER_TYPE_LABELS } from "@/lib/user/user-type";
import { VIP_DURATION_DAYS, VIP_PRICE_IDR } from "@/lib/user/set-user-type";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";

export async function GET(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;

  const access = await loadUserAccess(authResult.user.id);
  if (!access) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getEffectiveAiSettings(authResult.user.id);
  const quota = await getAiAssistantQuota(
    authResult.user.id,
    access,
    settings,
  );

  const db = await getDb();
  const row = await db.query.user.findFirst({
    where: eq(user.id, authResult.user.id),
  });

  return Response.json({
    userType: access.userType,
    userTypeLabel: access.isAdmin
      ? "Admin"
      : USER_TYPE_LABELS[access.userType],
    isAdmin: access.isAdmin,
    vipExpiresAt: row?.vipExpiresAt?.toISOString() ?? null,
    quota,
    vip: {
      priceIdr: VIP_PRICE_IDR,
      durationDays: VIP_DURATION_DAYS,
      trakteerUrl:
        process.env.TRAKTEER_PAGE_URL?.trim() || "https://trakteer.id/suluhadi",
    },
  });
}
