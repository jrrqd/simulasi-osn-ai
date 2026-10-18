import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { getAiAvailability } from "@/lib/ai/settings";
import { expireVipIfNeeded } from "@/lib/user/set-user-type";
import { parseUserType, type UserAccess } from "@/lib/user/user-type";

/** Deduped per React request — layout gates + page gates share one lookup. */
export const loadUserAccess = cache(
  async (userId: string): Promise<UserAccess | null> => {
    const db = await getDb();
    const row = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });
    if (!row) return null;

    const userType =
      row.role === "admin"
        ? parseUserType(row.userType)
        : ((await expireVipIfNeeded(userId)) ?? parseUserType(row.userType));

    const availability = await getAiAvailability(userId);
    return {
      id: row.id,
      role: row.role,
      userType,
      isAdmin: row.role === "admin",
      personalReady: availability.personalReady,
    };
  },
);
