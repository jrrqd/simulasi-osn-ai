import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { generatedMocks, mockOverrides, user } from "@/db/schema";
import { getMock, getMocks } from "@/lib/content/load";
import type { MockExam } from "@/lib/content/types";

export type SharedMockExam = MockExam & {
  source: "curated" | "ai";
  kind?: "ai" | "curated_assembled";
  track?: string;
  difficultyMode?: string;
  creatorName?: string | null;
  createdAt?: Date;
};

export type MockOverridePayload = {
  title: string;
  description: string;
  durationMinutes: number;
  problemIds: string[];
  track?: string;
  difficultyMode?: string;
  penaltyEnabled?: boolean;
  penaltyMinutesPerWrong?: number;
};

export type MockOverrideRow = {
  id: string;
  payload: MockOverridePayload | null;
  hidden: boolean;
  updatedBy: string | null;
  updatedAt: Date;
};

function asOverridePayload(raw: unknown): MockOverridePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = String(o.title || "").trim();
  const problemIds = Array.isArray(o.problemIds)
    ? o.problemIds.map(String).filter(Boolean)
    : [];
  if (!title || problemIds.length === 0) return null;
  return {
    title,
    description: String(o.description || ""),
    durationMinutes: Math.max(1, Math.round(Number(o.durationMinutes) || 30)),
    problemIds,
    track: o.track ? String(o.track) : undefined,
    difficultyMode: o.difficultyMode
      ? String(o.difficultyMode)
      : undefined,
    penaltyEnabled:
      typeof o.penaltyEnabled === "boolean" ? o.penaltyEnabled : undefined,
    penaltyMinutesPerWrong:
      typeof o.penaltyMinutesPerWrong === "number"
        ? Math.max(0, Math.round(o.penaltyMinutesPerWrong))
        : undefined,
  };
}

export function curatedMockIds(): Set<string> {
  return new Set(getMocks().map((m) => m.id));
}

export async function getMockOverride(
  id: string,
): Promise<MockOverrideRow | null> {
  const db = await getDb();
  const row = await db.query.mockOverrides.findFirst({
    where: eq(mockOverrides.id, id),
  });
  if (!row) return null;
  return {
    id: row.id,
    payload: asOverridePayload(row.payload),
    hidden: row.hidden,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}

export async function getMockOverridesMap(ids?: string[]) {
  const db = await getDb();
  const rows =
    ids && ids.length > 0
      ? await db
          .select()
          .from(mockOverrides)
          .where(inArray(mockOverrides.id, ids))
      : await db.select().from(mockOverrides);
  const map = new Map<string, MockOverrideRow>();
  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      payload: asOverridePayload(row.payload),
      hidden: row.hidden,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    });
  }
  return map;
}

export async function upsertMockOverride(params: {
  id: string;
  payload?: MockOverridePayload | null;
  hidden?: boolean;
  updatedBy: string;
}) {
  const db = await getDb();
  const existing = await getMockOverride(params.id);
  const hidden = params.hidden ?? existing?.hidden ?? false;
  const payload =
    params.payload === undefined
      ? (existing?.payload ?? null)
      : params.payload;

  await db
    .insert(mockOverrides)
    .values({
      id: params.id,
      payload: payload as Record<string, unknown> | null,
      hidden,
      updatedBy: params.updatedBy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: mockOverrides.id,
      set: {
        payload: payload as Record<string, unknown> | null,
        hidden,
        updatedBy: params.updatedBy,
        updatedAt: new Date(),
      },
    });
}

export async function deleteMockOverride(id: string) {
  const db = await getDb();
  await db.delete(mockOverrides).where(eq(mockOverrides.id, id));
}

function applyCuratedOverride(
  base: MockExam,
  ov?: MockOverrideRow,
): SharedMockExam | null {
  if (ov?.hidden) return null;
  if (ov?.payload) {
    return {
      id: base.id,
      title: ov.payload.title,
      description: ov.payload.description,
      durationMinutes: ov.payload.durationMinutes,
      problemIds: ov.payload.problemIds,
      source: "curated",
      track: ov.payload.track,
      difficultyMode: ov.payload.difficultyMode,
      penaltyEnabled:
        ov.payload.penaltyEnabled ?? base.penaltyEnabled ?? true,
      penaltyMinutesPerWrong:
        ov.payload.penaltyMinutesPerWrong ??
        base.penaltyMinutesPerWrong ??
        20,
    };
  }
  return {
    ...base,
    source: "curated",
    penaltyEnabled: base.penaltyEnabled ?? true,
    penaltyMinutesPerWrong: base.penaltyMinutesPerWrong ?? 20,
  };
}

export async function resolvePracticeMock(
  id: string,
): Promise<SharedMockExam | null> {
  const override = await getMockOverride(id);
  if (override?.hidden) return null;

  const curated = getMock(id);
  if (curated) {
    return applyCuratedOverride(curated, override ?? undefined);
  }

  const db = await getDb();
  const row = await db.query.generatedMocks.findFirst({
    where: eq(generatedMocks.id, id),
  });
  if (!row) return null;

  const creator = await db.query.user.findFirst({
    where: eq(user.id, row.createdBy),
  });

  // Optional overlay on AI mocks (e.g. admin retitle) via payload
  if (override?.payload) {
    return {
      id: row.id,
      title: override.payload.title,
      description: override.payload.description,
      durationMinutes: override.payload.durationMinutes,
      problemIds: override.payload.problemIds,
      source: "ai",
      kind: (row.kind as "ai" | "curated_assembled") ?? "ai",
      track: override.payload.track ?? row.track,
      difficultyMode:
        override.payload.difficultyMode ?? row.difficultyMode,
      creatorName: creator?.name ?? null,
      createdAt: row.createdAt,
      penaltyEnabled:
        override.payload.penaltyEnabled ?? row.penaltyEnabled ?? true,
      penaltyMinutesPerWrong:
        override.payload.penaltyMinutesPerWrong ??
        row.penaltyMinutesPerWrong ??
        20,
    };
  }

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
    penaltyEnabled: row.penaltyEnabled ?? true,
    penaltyMinutesPerWrong: row.penaltyMinutesPerWrong ?? 20,
  };
}

export async function listVisibleMocks(): Promise<SharedMockExam[]> {
  const overrides = await getMockOverridesMap();
  const curated: SharedMockExam[] = [];
  for (const base of getMocks()) {
    const applied = applyCuratedOverride(base, overrides.get(base.id));
    if (applied) curated.push(applied);
  }

  const curatedIds = [...curatedMockIds()];
  const hiddenIds = [...overrides.values()]
    .filter((o) => o.hidden)
    .map((o) => o.id);

  const db = await getDb();
  const conditions = [];
  if (curatedIds.length) {
    conditions.push(notInArray(generatedMocks.id, curatedIds));
  }
  if (hiddenIds.length) {
    conditions.push(notInArray(generatedMocks.id, hiddenIds));
  }

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
      penaltyEnabled: generatedMocks.penaltyEnabled,
      penaltyMinutesPerWrong: generatedMocks.penaltyMinutesPerWrong,
    })
    .from(generatedMocks)
    .leftJoin(user, eq(generatedMocks.createdBy, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(generatedMocks.createdAt))
    .limit(100);

  const shared: SharedMockExam[] = rows.map((row) => {
    const ov = overrides.get(row.id);
    if (ov?.payload) {
      return {
        id: row.id,
        title: ov.payload.title,
        description: ov.payload.description,
        durationMinutes: ov.payload.durationMinutes,
        problemIds: ov.payload.problemIds,
        source: "ai" as const,
        kind: (row.kind as "ai" | "curated_assembled") ?? "ai",
        track: ov.payload.track ?? row.track,
        difficultyMode: ov.payload.difficultyMode ?? row.difficultyMode,
        creatorName: row.creatorName,
        createdAt: row.createdAt,
        penaltyEnabled:
          ov.payload.penaltyEnabled ?? row.penaltyEnabled ?? true,
        penaltyMinutesPerWrong:
          ov.payload.penaltyMinutesPerWrong ??
          row.penaltyMinutesPerWrong ??
          20,
      };
    }
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      durationMinutes: row.durationMinutes,
      problemIds: (row.problemIds as string[]) ?? [],
      source: "ai" as const,
      kind: (row.kind as "ai" | "curated_assembled") ?? "ai",
      track: row.track,
      difficultyMode: row.difficultyMode,
      creatorName: row.creatorName,
      createdAt: row.createdAt,
      penaltyEnabled: row.penaltyEnabled ?? true,
      penaltyMinutesPerWrong: row.penaltyMinutesPerWrong ?? 20,
    };
  });

  return [...curated, ...shared];
}

export type AdminMockListItem = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  problemCount: number;
  track: string;
  difficultyMode: string;
  kind: string;
  source: "curated" | "ai";
  hidden: boolean;
  updatedAt?: string;
};

export async function listAdminMocks(params: {
  q?: string;
  source?: "curated" | "ai" | "all";
  includeHidden?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ items: AdminMockListItem[]; total: number }> {
  const limit = Math.min(Math.max(params.limit ?? 80, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);
  const q = params.q?.trim().toLowerCase() ?? "";
  const source = params.source ?? "all";
  const includeHidden = Boolean(params.includeHidden);
  const overrides = await getMockOverridesMap();
  const items: AdminMockListItem[] = [];

  if (source === "all" || source === "curated") {
    for (const base of getMocks()) {
      const ov = overrides.get(base.id);
      const hidden = Boolean(ov?.hidden);
      if (hidden && !includeHidden) continue;
      const title = ov?.payload?.title ?? base.title;
      const description = ov?.payload?.description ?? base.description;
      const durationMinutes =
        ov?.payload?.durationMinutes ?? base.durationMinutes;
      const problemIds = ov?.payload?.problemIds ?? base.problemIds;
      if (
        q &&
        !`${title} ${base.id} ${description}`.toLowerCase().includes(q)
      ) {
        continue;
      }
      items.push({
        id: base.id,
        title,
        description,
        durationMinutes,
        problemCount: problemIds.length,
        track: ov?.payload?.track ?? "—",
        difficultyMode: ov?.payload?.difficultyMode ?? "—",
        kind: "official",
        source: "curated",
        hidden,
        updatedAt: ov?.updatedAt?.toISOString(),
      });
    }
  }

  if (source === "all" || source === "ai") {
    const curatedIds = curatedMockIds();
    const db = await getDb();
    const conditions = [];
    if (curatedIds.size) {
      conditions.push(notInArray(generatedMocks.id, [...curatedIds]));
    }
    if (q) {
      conditions.push(
        sql`(lower(${generatedMocks.title}) like ${`%${q}%`} or lower(${generatedMocks.id}) like ${`%${q}%`} or lower(${generatedMocks.description}) like ${`%${q}%`})`,
      );
    }
    const rows = await db
      .select()
      .from(generatedMocks)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(generatedMocks.createdAt));

    for (const row of rows) {
      const ov = overrides.get(row.id);
      const hidden = Boolean(ov?.hidden);
      if (hidden && !includeHidden) continue;
      const title = ov?.payload?.title ?? row.title;
      const description = ov?.payload?.description ?? row.description;
      const durationMinutes =
        ov?.payload?.durationMinutes ?? row.durationMinutes;
      const problemIds =
        ov?.payload?.problemIds ?? ((row.problemIds as string[]) ?? []);
      items.push({
        id: row.id,
        title,
        description,
        durationMinutes,
        problemCount: problemIds.length,
        track: ov?.payload?.track ?? row.track,
        difficultyMode:
          ov?.payload?.difficultyMode ?? row.difficultyMode,
        kind: row.kind,
        source: "ai",
        hidden,
        updatedAt:
          ov?.updatedAt?.toISOString?.() ??
          row.createdAt?.toISOString?.() ??
          String(row.createdAt),
      });
    }
  }

  const total = items.length;
  return { items: items.slice(offset, offset + limit), total };
}
