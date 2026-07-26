import { and, count, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { generatedProblems, problemOverrides, user } from "@/db/schema";
import { getProblem, getProblems } from "@/lib/content/load";
import type { Problem } from "@/lib/content/types";

export type ProblemOverrideRow = {
  id: string;
  payload: Problem | null;
  hidden: boolean;
  updatedBy: string | null;
  updatedAt: Date;
};

export async function getProblemOverride(
  id: string,
): Promise<ProblemOverrideRow | null> {
  const db = await getDb();
  const row = await db.query.problemOverrides.findFirst({
    where: eq(problemOverrides.id, id),
  });
  if (!row) return null;
  return {
    id: row.id,
    payload: (row.payload as Problem | null) ?? null,
    hidden: row.hidden,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}

export async function getProblemOverridesMap(ids?: string[]) {
  const db = await getDb();
  const rows =
    ids && ids.length > 0
      ? await db
          .select()
          .from(problemOverrides)
          .where(inArray(problemOverrides.id, ids))
      : await db.select().from(problemOverrides);
  const map = new Map<string, ProblemOverrideRow>();
  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      payload: (row.payload as Problem | null) ?? null,
      hidden: row.hidden,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    });
  }
  return map;
}

export function curatedProblemIds(): Set<string> {
  return new Set(getProblems().map((p) => p.id));
}

/** Curated bank with overrides applied; hidden curated removed. */
export async function listVisibleCuratedProblems(params?: {
  track?: string;
  topic?: string;
}): Promise<Problem[]> {
  let problems = getProblems();
  if (params?.track) {
    problems = problems.filter((p) => p.track === params.track);
  }
  if (params?.topic) {
    problems = problems.filter((p) => p.topic === params.topic);
  }
  const overrides = await getProblemOverridesMap(problems.map((p) => p.id));
  const out: Problem[] = [];
  for (const base of problems) {
    const ov = overrides.get(base.id);
    if (ov?.hidden) continue;
    if (ov?.payload) {
      out.push({ ...ov.payload, id: base.id, source: "curated" });
    } else {
      out.push(base);
    }
  }
  return out;
}

export async function resolvePracticeProblem(
  id: string,
): Promise<Problem | null> {
  const override = await getProblemOverride(id);
  if (override?.hidden) return null;
  if (override?.payload) {
    return {
      ...override.payload,
      id,
      source: override.payload.source ?? "curated",
    };
  }

  const db = await getDb();
  const gen = await db.query.generatedProblems.findFirst({
    where: eq(generatedProblems.id, id),
  });
  if (gen) {
    return gen.payload as Problem;
  }

  return getProblem(id) ?? null;
}

export async function countVisibleAiProblems(params?: {
  track?: string;
  topic?: string;
}) {
  const db = await getDb();
  const curatedIds = [...curatedProblemIds()];
  const hiddenRows = await db
    .select({ id: problemOverrides.id })
    .from(problemOverrides)
    .where(eq(problemOverrides.hidden, true));
  const hiddenIds = hiddenRows.map((r) => r.id);

  const conditions = [];
  if (params?.track) conditions.push(eq(generatedProblems.track, params.track));
  if (params?.topic) conditions.push(eq(generatedProblems.topic, params.topic));
  if (curatedIds.length) {
    conditions.push(notInArray(generatedProblems.id, curatedIds));
  }
  if (hiddenIds.length) {
    conditions.push(notInArray(generatedProblems.id, hiddenIds));
  }

  const [row] = await db
    .select({ n: count() })
    .from(generatedProblems)
    .where(conditions.length ? and(...conditions) : undefined);
  return Number(row?.n ?? 0);
}

export async function countVisiblePracticeProblems() {
  const curated = await listVisibleCuratedProblems();
  const ai = await countVisibleAiProblems();
  return curated.length + ai;
}

export async function listVisibleAiProblems(params: {
  track?: string;
  topic?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);
  const curatedIds = [...curatedProblemIds()];
  const hiddenRows = await db
    .select({ id: problemOverrides.id })
    .from(problemOverrides)
    .where(eq(problemOverrides.hidden, true));
  const hiddenIds = hiddenRows.map((r) => r.id);

  const conditions = [];
  if (params.track) conditions.push(eq(generatedProblems.track, params.track));
  if (params.topic) conditions.push(eq(generatedProblems.topic, params.topic));
  if (curatedIds.length) {
    conditions.push(notInArray(generatedProblems.id, curatedIds));
  }
  if (hiddenIds.length) {
    conditions.push(notInArray(generatedProblems.id, hiddenIds));
  }

  const rows = await db
    .select({
      id: generatedProblems.id,
      title: generatedProblems.title,
      track: generatedProblems.track,
      topic: generatedProblems.topic,
      difficulty: generatedProblems.difficulty,
      difficultyMode: generatedProblems.difficultyMode,
      createdAt: generatedProblems.createdAt,
      creatorName: user.name,
      creatorId: user.id,
      payload: generatedProblems.payload,
    })
    .from(generatedProblems)
    .leftJoin(user, eq(generatedProblems.userId, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(generatedProblems.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => {
    const payload = row.payload as Problem;
    return {
      id: row.id,
      title: row.title || payload.title || row.id,
      track: row.track,
      topic: row.topic,
      difficulty: row.difficulty,
      difficultyMode: row.difficultyMode,
      createdAt: row.createdAt,
      creatorName: row.creatorName,
      creatorId: row.creatorId,
      source: "ai" as const,
      answerType: payload.answerType,
    };
  });
}

export async function upsertProblemOverride(params: {
  id: string;
  payload?: Problem | null;
  hidden?: boolean;
  updatedBy: string;
}) {
  const db = await getDb();
  const existing = await getProblemOverride(params.id);
  const hidden = params.hidden ?? existing?.hidden ?? false;
  const payload =
    params.payload === undefined
      ? (existing?.payload ?? null)
      : params.payload;

  await db
    .insert(problemOverrides)
    .values({
      id: params.id,
      payload: payload as Record<string, unknown> | null,
      hidden,
      updatedBy: params.updatedBy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: problemOverrides.id,
      set: {
        payload: payload as Record<string, unknown> | null,
        hidden,
        updatedBy: params.updatedBy,
        updatedAt: new Date(),
      },
    });
}

export async function deleteProblemOverride(id: string) {
  const db = await getDb();
  await db.delete(problemOverrides).where(eq(problemOverrides.id, id));
}

export type AdminProblemListItem = {
  id: string;
  title: string;
  track: string;
  topic: string;
  difficulty: number;
  answerType: string;
  source: "curated" | "ai";
  hidden: boolean;
  updatedAt?: string;
};

export async function listAdminPracticeProblems(params: {
  track?: string;
  topic?: string;
  q?: string;
  source?: "curated" | "ai" | "all";
  includeHidden?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ items: AdminProblemListItem[]; total: number }> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);
  const q = params.q?.trim().toLowerCase() ?? "";
  const source = params.source ?? "all";
  const includeHidden = Boolean(params.includeHidden);

  const overrides = await getProblemOverridesMap();
  const items: AdminProblemListItem[] = [];

  if (source === "all" || source === "curated") {
    for (const base of getProblems()) {
      if (params.track && base.track !== params.track) continue;
      if (params.topic && base.topic !== params.topic) continue;
      const ov = overrides.get(base.id);
      const problem = ov?.payload
        ? { ...ov.payload, id: base.id }
        : base;
      const hidden = Boolean(ov?.hidden);
      if (hidden && !includeHidden) continue;
      if (
        q &&
        !`${problem.title} ${problem.id} ${problem.topic}`
          .toLowerCase()
          .includes(q)
      ) {
        continue;
      }
      items.push({
        id: problem.id,
        title: problem.title,
        track: problem.track,
        topic: problem.topic,
        difficulty: problem.difficulty,
        answerType: problem.answerType,
        source: "curated",
        hidden,
        updatedAt: ov?.updatedAt?.toISOString(),
      });
    }
  }

  if (source === "all" || source === "ai") {
    const curatedIds = curatedProblemIds();
    const db = await getDb();
    const conditions = [];
    if (params.track) conditions.push(eq(generatedProblems.track, params.track));
    if (params.topic) conditions.push(eq(generatedProblems.topic, params.topic));
    if (curatedIds.size) {
      conditions.push(notInArray(generatedProblems.id, [...curatedIds]));
    }
    if (q) {
      conditions.push(
        sql`(lower(${generatedProblems.title}) like ${`%${q}%`} or lower(${generatedProblems.id}) like ${`%${q}%`} or lower(${generatedProblems.topic}) like ${`%${q}%`})`,
      );
    }

    const rows = await db
      .select()
      .from(generatedProblems)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(generatedProblems.createdAt));

    for (const row of rows) {
      const ov = overrides.get(row.id);
      const hidden = Boolean(ov?.hidden);
      if (hidden && !includeHidden) continue;
      const payload = row.payload as Problem;
      items.push({
        id: row.id,
        title: row.title || payload.title || row.id,
        track: row.track,
        topic: row.topic,
        difficulty: row.difficulty,
        answerType: payload.answerType,
        source: "ai",
        hidden,
        updatedAt: (ov?.updatedAt ?? row.createdAt)?.toISOString?.() ??
          String(ov?.updatedAt ?? row.createdAt),
      });
    }
  }

  // Curated first (stable), then AI by recency already appended
  const total = items.length;
  return { items: items.slice(offset, offset + limit), total };
}
