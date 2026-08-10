import { getAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { shouldBypassRateLimits } from "@/lib/ai/access-policy";
import { loadUserAccess } from "@/lib/user/load-user-access";
import type { UserAccess } from "@/lib/user/user-type";

export async function requireApiUser(req: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  if (!session?.user) {
    return {
      error: Response.json({ error: "Unauthorized" }, { status: 401 }) as Response,
    };
  }
  return { user: session.user };
}

export async function requireApiAdmin(req: Request) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult;

  const db = await getDb();
  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, authResult.user.id),
  });
  if (currentUser?.role !== "admin") {
    return {
      error: Response.json({ error: "Admin access required" }, { status: 403 }),
    };
  }
  return { user: currentUser };
}

const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now > cur.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count += 1;
  return true;
}

/**
 * Per-user rate limit that skips the bucket for admin and test accounts.
 * Pass `access` when already loaded to avoid an extra DB round-trip.
 */
export async function rateLimitForUser(
  userId: string,
  key: string,
  limit = 20,
  windowMs = 60_000,
  access?: UserAccess | null,
): Promise<boolean> {
  const resolved = access ?? (await loadUserAccess(userId));
  if (resolved && shouldBypassRateLimits(resolved)) {
    return true;
  }
  return rateLimit(`${key}:${userId}`, limit, windowMs);
}
