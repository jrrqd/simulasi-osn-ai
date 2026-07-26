import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { generatedMocks, generatedProblems } from "@/db/schema";
import type { Problem } from "@/lib/content/types";
import {
  countVisibleAiProblems,
  listVisibleAiProblems,
  resolvePracticeProblem,
} from "@/lib/content/problem-library";
import {
  listVisibleMocks,
  resolvePracticeMock,
  type SharedMockExam,
} from "@/lib/content/mock-library";

export type { SharedMockExam };

export async function getGeneratedProblem(id: string): Promise<Problem | null> {
  const db = await getDb();
  const row = await db.query.generatedProblems.findFirst({
    where: eq(generatedProblems.id, id),
  });
  if (!row) return null;
  return row.payload as Problem;
}

export async function resolveProblem(id: string): Promise<Problem | null> {
  return resolvePracticeProblem(id);
}

export async function countSharedProblems() {
  return countVisibleAiProblems();
}

export async function listSharedProblems(params: {
  track?: string;
  topic?: string;
  limit?: number;
  offset?: number;
}) {
  return listVisibleAiProblems(params);
}

export async function getGeneratedMock(id: string) {
  const db = await getDb();
  return db.query.generatedMocks.findFirst({
    where: eq(generatedMocks.id, id),
  });
}

export async function resolveMock(id: string): Promise<SharedMockExam | null> {
  return resolvePracticeMock(id);
}

export async function resolveProblemsForMock(
  mockId: string,
): Promise<Problem[]> {
  const mock = await resolveMock(mockId);
  if (!mock) return [];
  const problems: Problem[] = [];
  for (const id of mock.problemIds) {
    const p = await resolveProblem(id);
    if (p) problems.push(p);
  }
  return problems;
}

export async function listAllMocks(): Promise<SharedMockExam[]> {
  return listVisibleMocks();
}
