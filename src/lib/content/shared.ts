import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { generatedMocks, generatedProblems, user } from "@/db/schema";
import type { MockExam, Problem } from "@/lib/content/types";
import { getMock, getMocks } from "@/lib/content/load";
import {
  countVisibleAiProblems,
  listVisibleAiProblems,
  resolvePracticeProblem,
} from "@/lib/content/problem-library";

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

export type SharedMockExam = MockExam & {
  source: "curated" | "ai";
  kind?: "ai" | "curated_assembled";
  track?: string;
  difficultyMode?: string;
  creatorName?: string | null;
  createdAt?: Date;
};

export async function getGeneratedMock(id: string) {
  const db = await getDb();
  return db.query.generatedMocks.findFirst({
    where: eq(generatedMocks.id, id),
  });
}

export async function resolveMock(id: string): Promise<SharedMockExam | null> {
  const curated = getMock(id);
  if (curated) {
    return { ...curated, source: "curated" };
  }
  const row = await getGeneratedMock(id);
  if (!row) return null;
  const db = await getDb();
  const creator = await db.query.user.findFirst({
    where: eq(user.id, row.createdBy),
  });
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    durationMinutes: row.durationMinutes,
    problemIds: row.problemIds as string[],
    source: "ai",
    kind: (row.kind as "ai" | "curated_assembled") ?? "ai",
    track: row.track,
    difficultyMode: row.difficultyMode,
    creatorName: creator?.name ?? null,
    createdAt: row.createdAt,
  };
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
  const curated: SharedMockExam[] = getMocks().map((m) => ({
    ...m,
    source: "curated" as const,
  }));
  const db = await getDb();
  const rows = await db
    .select({
      id: generatedMocks.id,
      title: generatedMocks.title,
      description: generatedMocks.description,
      durationMinutes: generatedMocks.durationMinutes,
      problemIds: generatedMocks.problemIds,
      track: generatedMocks.track,
      difficultyMode: generatedMocks.difficultyMode,
      kind: generatedMocks.kind,
      createdAt: generatedMocks.createdAt,
      creatorName: user.name,
    })
    .from(generatedMocks)
    .leftJoin(user, eq(generatedMocks.createdBy, user.id))
    .orderBy(desc(generatedMocks.createdAt))
    .limit(50);

  const shared: SharedMockExam[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    durationMinutes: row.durationMinutes,
    problemIds: (row.problemIds as string[]) ?? [],
    source: "ai",
    kind: (row.kind as "ai" | "curated_assembled") ?? "ai",
    track: row.track,
    difficultyMode: row.difficultyMode,
    creatorName: row.creatorName,
    createdAt: row.createdAt,
  }));

  return [...curated, ...shared];
}
