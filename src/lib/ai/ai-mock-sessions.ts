import type { AiMockPlanMeta, AiMockSlot } from "@/lib/ai/ai-mock-plan";

type AiMockSession = {
  userId: string;
  slots: AiMockSlot[];
  meta: AiMockPlanMeta;
  problemIds: Array<string | null>;
  expiresAt: number;
};

// Full 40-soal AI generation can run for well over an hour.
const SESSION_TTL_MS = 3 * 60 * 60_000;
const sessions = new Map<string, AiMockSession>();

function pruneExpired() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}

export function createAiMockSession(params: {
  userId: string;
  slots: AiMockSlot[];
  meta: AiMockPlanMeta;
}): string {
  pruneExpired();
  const id = `aimockplan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  sessions.set(id, {
    userId: params.userId,
    slots: params.slots,
    meta: params.meta,
    problemIds: Array.from({ length: params.slots.length }, () => null),
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return id;
}

export function getAiMockSession(planId: string, userId: string) {
  pruneExpired();
  const session = sessions.get(planId);
  if (!session || session.userId !== userId) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(planId);
    return null;
  }
  return session;
}

export function setAiMockSessionProblem(
  planId: string,
  userId: string,
  index: number,
  problemId: string,
) {
  const session = getAiMockSession(planId, userId);
  if (!session) return null;
  if (index < 0 || index >= session.problemIds.length) return null;
  session.problemIds[index] = problemId;
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

export function consumeAiMockSession(planId: string, userId: string) {
  const session = getAiMockSession(planId, userId);
  if (!session) return null;
  sessions.delete(planId);
  return session;
}
