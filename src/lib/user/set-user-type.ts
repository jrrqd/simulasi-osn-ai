import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { isUserType, type UserType } from "@/lib/user/user-type";

export const VIP_DURATION_DAYS = Number(
  process.env.VIP_DURATION_DAYS ?? "30",
);
export const VIP_PRICE_IDR = Number(process.env.VIP_PRICE_IDR ?? "50000");

/**
 * Set a student's tier (free | vip | test). Admins keep role=admin and
 * are not switched via this helper.
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
  const patch: Partial<typeof user.$inferInsert> = {
    userType,
    updatedAt: new Date(),
  };
  if (userType !== "vip") {
    patch.vipExpiresAt = null;
  }
  await db.update(user).set(patch).where(eq(user.id, userId));
  return { ok: true, userType };
}

/** Extend or start a paid VIP window by `days` (default 30). */
export async function grantVipMembership(
  userId: string,
  days: number = VIP_DURATION_DAYS,
  now: Date = new Date(),
): Promise<
  | { ok: true; userType: "vip"; vipExpiresAt: Date }
  | { ok: false; error: string }
> {
  if (!Number.isFinite(days) || days <= 0) {
    return { ok: false, error: "Durasi VIP tidak valid" };
  }
  const db = await getDb();
  const row = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });
  if (!row) {
    return { ok: false, error: "User tidak ditemukan" };
  }
  if (row.role === "admin") {
    return { ok: false, error: "Akun admin tidak memakai VIP berjangka" };
  }

  const base =
    row.userType === "vip" &&
    row.vipExpiresAt &&
    row.vipExpiresAt.getTime() > now.getTime()
      ? row.vipExpiresAt
      : now;
  const vipExpiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  await db
    .update(user)
    .set({
      userType: "vip",
      vipExpiresAt,
      updatedAt: now,
    })
    .where(eq(user.id, userId));

  return { ok: true, userType: "vip", vipExpiresAt };
}

/** @deprecated Prefer grantVipMembership for paid upgrades. */
export async function upgradeUserToVip(userId: string) {
  return grantVipMembership(userId, VIP_DURATION_DAYS);
}

/**
 * If a timed VIP has expired, demote to free. Returns the effective userType
 * after any demotion.
 */
export async function expireVipIfNeeded(
  userId: string,
  now: Date = new Date(),
): Promise<UserType | null> {
  const db = await getDb();
  const row = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });
  if (!row || row.role === "admin") {
    return row ? (row.userType as UserType) : null;
  }
  if (
    row.userType === "vip" &&
    row.vipExpiresAt &&
    row.vipExpiresAt.getTime() <= now.getTime()
  ) {
    await db
      .update(user)
      .set({
        userType: "free",
        vipExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(user.id, userId));
    return "free";
  }
  return isUserType(row.userType) ? row.userType : "free";
}
