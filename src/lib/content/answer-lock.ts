import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { mockSessions } from "@/db/schema";
import { listVisibleMocks } from "@/lib/content/mock-library";

/**
 * True when this problem belongs to a simulasi the user has not submitted.
 * Practice feedback and answer keys stay hidden until every such mock is in.
 */
export async function isProblemAnswerLocked(
  userId: string,
  problemId: string,
): Promise<boolean> {
  const mocks = await listVisibleMocks();
  const containing = mocks.filter((mock) => mock.problemIds.includes(problemId));
  if (containing.length === 0) return false;

  const db = await getDb();
  const submitted = await db
    .select({ mockId: mockSessions.mockId })
    .from(mockSessions)
    .where(
      and(
        eq(mockSessions.userId, userId),
        eq(mockSessions.status, "submitted"),
        inArray(
          mockSessions.mockId,
          containing.map((mock) => mock.id),
        ),
      ),
    );
  const done = new Set(submitted.map((row) => row.mockId));
  return containing.some((mock) => !done.has(mock.id));
}
