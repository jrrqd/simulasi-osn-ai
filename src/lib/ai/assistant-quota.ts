import { and, count, eq, gte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { assistantChatEvents } from "@/db/schema";
import {
  DEFAULT_ACCESS_MATRIX,
  type AccessMatrix,
} from "@/lib/access/catalog";
import { getAccessMatrix, hasFeature } from "@/lib/access/matrix";
import {
  nextDayAsiaJakarta,
  startOfDayAsiaJakarta,
} from "@/lib/ai/simulasi-quota";
import type { EffectiveAiSource } from "@/lib/ai/access-policy";
import type { UserAccess } from "@/lib/user/user-type";

/** Free users get this many assistant chats per WIB day. */
export const FREE_AI_ASSISTANT_DAILY_LIMIT = 5;

export type AssistantChatSource =
  | "study"
  | "practice"
  | "performance"
  | "admin"
  | "teach";

export type AiAssistantQuota = {
  used: number;
  /** null = unlimited */
  limit: number | null;
  remaining: number | null;
  resetsAt: string;
  gated: boolean;
};

export function shouldBypassAiAssistantQuota(
  access: UserAccess,
  settings: EffectiveAiSource | null | undefined,
  matrix: AccessMatrix = DEFAULT_ACCESS_MATRIX,
): boolean {
  if (hasFeature(access, "bypass_ai_assistant_quota", matrix)) return true;
  if (settings?.source === "personal" || access.personalReady) return true;
  return false;
}

export async function countAssistantChatsToday(
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const db = await getDb();
  const since = startOfDayAsiaJakarta(now);
  const [row] = await db
    .select({ value: count() })
    .from(assistantChatEvents)
    .where(
      and(
        eq(assistantChatEvents.userId, userId),
        gte(assistantChatEvents.createdAt, since),
      ),
    );
  return Number(row?.value ?? 0);
}

export async function getAiAssistantQuota(
  userId: string,
  access: UserAccess,
  settings: EffectiveAiSource | null | undefined,
  now: Date = new Date(),
): Promise<AiAssistantQuota> {
  const matrix = await getAccessMatrix();
  const gated = !shouldBypassAiAssistantQuota(access, settings, matrix);
  const used = await countAssistantChatsToday(userId, now);
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

  const limit = FREE_AI_ASSISTANT_DAILY_LIMIT;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt,
    gated: true,
  };
}

export function aiAssistantQuotaExceededResponse(quota: AiAssistantQuota) {
  return Response.json(
    {
      error:
        "Kuota asisten AI hari ini sudah habis (5 chat/hari untuk akun gratis). Upgrade ke VIP di Pengaturan → Upgrade, atau coba lagi besok setelah 00:00 WIB.",
      code: "AI_ASSISTANT_QUOTA_EXCEEDED",
      quota: {
        used: quota.used,
        limit: quota.limit,
        remaining: quota.remaining,
        resetsAt: quota.resetsAt,
      },
      upgradePath: "/settings/upgrade",
    },
    { status: 429 },
  );
}

export async function assertAiAssistantAllowed(
  userId: string,
  access: UserAccess,
  settings: EffectiveAiSource | null | undefined,
): Promise<Response | null> {
  const quota = await getAiAssistantQuota(userId, access, settings);
  if (
    quota.gated &&
    quota.limit != null &&
    quota.remaining != null &&
    quota.remaining <= 0
  ) {
    return aiAssistantQuotaExceededResponse(quota);
  }
  return null;
}

export async function recordAssistantChat(
  userId: string,
  source: AssistantChatSource,
): Promise<void> {
  const db = await getDb();
  await db.insert(assistantChatEvents).values({
    id: nanoid(),
    userId,
    source,
    createdAt: new Date(),
  });
}

function userLockKey(userId: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

/**
 * Count and insert one assistant chat under a transaction-scoped advisory lock
 * so parallel requests cannot all pass a stale remaining-quota check.
 * Returns a 429 response when the free daily cap is already used.
 */
export async function reserveAssistantChat(
  userId: string,
  source: AssistantChatSource,
  access: UserAccess,
  settings: EffectiveAiSource | null | undefined,
): Promise<Response | null> {
  const matrix = await getAccessMatrix();
  const gated = !shouldBypassAiAssistantQuota(access, settings, matrix);
  const now = new Date();
  const since = startOfDayAsiaJakarta(now);
  const resetsAt = nextDayAsiaJakarta(now).toISOString();
  const db = await getDb();

  let blocked: Response | null = null;
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(481516234, ${userLockKey(userId)})`,
    );
    const [row] = await tx
      .select({ value: count() })
      .from(assistantChatEvents)
      .where(
        and(
          eq(assistantChatEvents.userId, userId),
          gte(assistantChatEvents.createdAt, since),
        ),
      );
    const used = Number(row?.value ?? 0);
    if (gated && used >= FREE_AI_ASSISTANT_DAILY_LIMIT) {
      blocked = aiAssistantQuotaExceededResponse({
        used,
        limit: FREE_AI_ASSISTANT_DAILY_LIMIT,
        remaining: 0,
        resetsAt,
        gated: true,
      });
      return;
    }
    await tx.insert(assistantChatEvents).values({
      id: nanoid(),
      userId,
      source,
      createdAt: now,
    });
  });
  return blocked;
}
