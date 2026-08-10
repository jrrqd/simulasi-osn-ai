import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { generatedMocks } from "@/db/schema";
import {
  isSimulasiQuotaGated,
  type EffectiveAiSource,
} from "@/lib/ai/access-policy";
import type { UserAccess } from "@/lib/user/user-type";

/** Free shared-LLM users get this many simulasi generations per WIB day. */
export const FREE_SIMULASI_DAILY_LIMIT = 1;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Start of the current calendar day in Asia/Jakarta (WIB, UTC+7). */
export function startOfDayAsiaJakarta(now: Date = new Date()): Date {
  const wibMs = now.getTime() + WIB_OFFSET_MS;
  const wib = new Date(wibMs);
  const startWibUtcMs = Date.UTC(
    wib.getUTCFullYear(),
    wib.getUTCMonth(),
    wib.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  return new Date(startWibUtcMs - WIB_OFFSET_MS);
}

/** Start of the next calendar day in Asia/Jakarta. */
export function nextDayAsiaJakarta(now: Date = new Date()): Date {
  const start = startOfDayAsiaJakarta(now);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export type SimulasiQuota = {
  used: number;
  /** null = unlimited */
  limit: number | null;
  remaining: number | null;
  resetsAt: string;
  gated: boolean;
};

export async function countSimulasiToday(
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const db = await getDb();
  const since = startOfDayAsiaJakarta(now);
  const [row] = await db
    .select({ value: count() })
    .from(generatedMocks)
    .where(
      and(
        eq(generatedMocks.createdBy, userId),
        gte(generatedMocks.createdAt, since),
      ),
    );
  return Number(row?.value ?? 0);
}

export async function getSimulasiQuota(
  userId: string,
  access: UserAccess,
  settings: EffectiveAiSource | null | undefined,
  now: Date = new Date(),
): Promise<SimulasiQuota> {
  const gated = isSimulasiQuotaGated(access, settings);
  const used = await countSimulasiToday(userId, now);
  const resetsAt = nextDayAsiaJakarta(now).toISOString();

  if (!gated) {
    return {
      used,
      limit: null,
      remaining: null,
      resetsAt,
      gated: false,
    };
  }

  const limit = FREE_SIMULASI_DAILY_LIMIT;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt,
    gated: true,
  };
}

export function simulasiQuotaExceededResponse(quota: SimulasiQuota) {
  return Response.json(
    {
      error:
        "Kuota simulasi hari ini sudah habis (1×/hari untuk akun gratis). Coba lagi besok, upgrade ke VIP, atau pasang API key sendiri di Pengaturan.",
      code: "SIMULASI_QUOTA_EXCEEDED",
      quota: {
        used: quota.used,
        limit: quota.limit,
        remaining: quota.remaining,
        resetsAt: quota.resetsAt,
      },
    },
    { status: 429 },
  );
}

/** Returns a 429 Response if the user has exhausted their daily simulasi quota. */
export async function assertSimulasiAllowed(
  userId: string,
  access: UserAccess,
  settings: EffectiveAiSource | null | undefined,
): Promise<Response | null> {
  const quota = await getSimulasiQuota(userId, access, settings);
  if (
    quota.gated &&
    quota.limit != null &&
    quota.remaining != null &&
    quota.remaining <= 0
  ) {
    return simulasiQuotaExceededResponse(quota);
  }
  return null;
}
