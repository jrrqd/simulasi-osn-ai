import { desc, eq, inArray, and } from "drizzle-orm";
import { getDb } from "@/db";
import { mockSessions } from "@/db/schema";

export type MockProgress = {
  mockId: string;
  /** Submitted sessions only. */
  attemptCount: number;
  hasInProgress: boolean;
  /** Best submitted score ratio 0–1. */
  bestScoreRatio: number | null;
  /** Most recent submitted score ratio 0–1. */
  lastScoreRatio: number | null;
  lastSubmittedAt: Date | null;
};

function ratio(score: number | null, maxScore: number | null): number | null {
  if (score == null || maxScore == null || maxScore <= 0) return null;
  return Math.max(0, Math.min(1, score / maxScore));
}

/** Aggregate mock session progress for a student, keyed by mockId. */
export async function getUserMockProgress(
  userId: string,
  mockIds?: string[],
): Promise<Map<string, MockProgress>> {
  const db = await getDb();
  const rows = await db
    .select({
      mockId: mockSessions.mockId,
      status: mockSessions.status,
      score: mockSessions.score,
      maxScore: mockSessions.maxScore,
      submittedAt: mockSessions.submittedAt,
      startedAt: mockSessions.startedAt,
    })
    .from(mockSessions)
    .where(
      mockIds && mockIds.length > 0
        ? and(
            eq(mockSessions.userId, userId),
            inArray(mockSessions.mockId, mockIds),
          )
        : eq(mockSessions.userId, userId),
    )
    .orderBy(desc(mockSessions.startedAt));

  const map = new Map<string, MockProgress>();

  for (const row of rows) {
    const existing = map.get(row.mockId) ?? {
      mockId: row.mockId,
      attemptCount: 0,
      hasInProgress: false,
      bestScoreRatio: null as number | null,
      lastScoreRatio: null as number | null,
      lastSubmittedAt: null as Date | null,
    };

    if (row.status === "in_progress") {
      existing.hasInProgress = true;
    } else if (row.status === "submitted") {
      const r = ratio(row.score, row.maxScore);
      existing.attemptCount += 1;
      if (existing.lastScoreRatio == null && r != null) {
        existing.lastScoreRatio = r;
        existing.lastSubmittedAt = row.submittedAt ?? row.startedAt;
      }
      if (r != null) {
        existing.bestScoreRatio =
          existing.bestScoreRatio == null
            ? r
            : Math.max(existing.bestScoreRatio, r);
      }
    }

    map.set(row.mockId, existing);
  }

  return map;
}
