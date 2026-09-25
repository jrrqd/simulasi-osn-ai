import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { isUserType, type UserType } from "@/lib/user/user-type";

/**
 * Set a student's tier (free | vip | test). Admins keep role=admin and
 * are not switched via this helper — payment webhooks should call this
 * after a successful Gratis → VIP purchase.
 */
export async function setUserType(
  userId: string,
  userType: UserType,
): Promise<{ ok: true; userType: UserType } | { ok: false; error: string }> {
  if (!isUserType(userType)) {
    return { ok: false, error: "Tipe user tidak valid" };
  }
  const db = await getDb();
  const row = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });
  if (!row) {
    return { ok: false, error: "User tidak ditemukan" };
  }
  if (row.role === "admin") {
    return {
      ok: false,
      error: "Akun admin tidak memakai tier siswa; ubah role lewat Pengguna",
    };
  }
  await db
    .update(user)
    .set({ userType, updatedAt: new Date() })
    .where(eq(user.id, userId));
  return { ok: true, userType };
}

/** Convenience for payment webhooks: upgrade free → vip. */
export async function upgradeUserToVip(userId: string) {
  return setUserType(userId, "vip");
}
