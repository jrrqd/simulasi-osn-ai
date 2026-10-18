import { getAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { shouldBypassRateLimits } from "@/lib/ai/access-policy";
import { getAccessMatrix } from "@/lib/access/matrix";
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
const MAX_BUCKETS = 5_000;
let lastEvictAt = 0;

function evictExpiredBuckets(now: number) {
  // Throttle eviction so hot paths stay cheap.
  if (now - lastEvictAt < 30_000 && buckets.size < MAX_BUCKETS) return;
  lastEvictAt = now;
  for (const [key, value] of buckets) {
    if (now > value.reset) buckets.delete(key);
  }
  // Hard cap: drop oldest-ish keys if still oversized after expiry sweep.
  if (buckets.size > MAX_BUCKETS) {
    const overflow = buckets.size - MAX_BUCKETS;
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}

export function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  evictExpiredBuckets(now);
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
  if (resolved && shouldBypassRateLimits(resolved, await getAccessMatrix())) {
    return true;
  }
  return rateLimit(`${key}:${userId}`, limit, windowMs);
}

/** Strip control chars / quotes for Content-Disposition filenames. */
export function safeContentDispositionFilename(name: string): string {
  return name
    .replace(/[\r\n"]/g, "")
    .replace(/[^\w.\-()+ ]+/g, "_")
    .slice(0, 120) || "download";
}
