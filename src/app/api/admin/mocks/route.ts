import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { generatedMocks } from "@/db/schema";
import { requireApiAdmin } from "@/lib/api";
import { getMock } from "@/lib/content/load";
import {
  curatedMockIds,
  deleteMockOverride,
  getMockOverride,
  listAdminMocks,
  resolvePracticeMock,
  upsertMockOverride,
  type MockOverridePayload,
} from "@/lib/content/mock-library";
import { resolvePracticeProblem } from "@/lib/content/problem-library";
import { TRACKS, type TrackId } from "@/lib/content/types";
import { parseDifficultyMode } from "@/lib/ai/difficulty";

const mockBodySchema = z.object({
  title: z.coerce.string().min(3).max(240),
  description: z.coerce.string().max(2000).optional().default(""),
  durationMinutes: z.coerce.number().int().min(5).max(300),
  problemIds: z.array(z.coerce.string().min(1)).min(1).max(80),
  track: z.enum(["A", "B", "C", "D"]).catch("B"),
  difficultyMode: z
    .string()
    .transform((v) => parseDifficultyMode(v))
    .catch("medium"),
  kind: z.enum(["ai", "curated_assembled"]).catch("ai"),
  penaltyEnabled: z.boolean().optional().default(true),
  penaltyMinutesPerWrong: z.coerce.number().int().min(0).max(120).optional().default(20),
});

async function validateProblemIds(ids: string[]) {
  const missing: string[] = [];
  for (const id of ids) {
    const p = await resolvePracticeProblem(id);
    if (!p) missing.push(id);
  }
  return missing;
}

function toPayload(
  parsed: z.infer<typeof mockBodySchema>,
): MockOverridePayload {
  return {
    title: parsed.title.trim(),
    description: parsed.description.trim(),
    durationMinutes: parsed.durationMinutes,
    problemIds: parsed.problemIds.map(String),
    track: parsed.track,
    difficultyMode: parsed.difficultyMode,
    penaltyEnabled: parsed.penaltyEnabled,
    penaltyMinutesPerWrong: parsed.penaltyMinutesPerWrong,
  };
}

export async function GET(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const mock = await resolvePracticeMock(id);
    if (!mock) {
      const curated = getMock(id);
      const override = await getMockOverride(id);
      if (override?.hidden && curated) {
        return Response.json({
          mock: override.payload
            ? {
                id,
                ...override.payload,
                source: "curated",
              }
            : { ...curated, source: "curated" },
          source: "curated",
          hidden: true,
        });
      }
      return Response.json({ error: "Simulasi tidak ditemukan" }, { status: 404 });
    }
    const source = curatedMockIds().has(id) ? "curated" : "ai";
    const override = await getMockOverride(id);
    return Response.json({
      mock,
      source,
      hidden: Boolean(override?.hidden),
    });
  }

  const result = await listAdminMocks({
    q: url.searchParams.get("q") || undefined,
    source:
      (url.searchParams.get("source") as "curated" | "ai" | "all" | null) ||
      "all",
    includeHidden: url.searchParams.get("includeHidden") === "1",
    limit: Number(url.searchParams.get("limit") || 80),
    offset: Number(url.searchParams.get("offset") || 0),
  });
  return Response.json(result);
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  let parsed: z.infer<typeof mockBodySchema>;
  try {
    parsed = mockBodySchema.parse(await req.json());
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Payload tidak valid",
      },
      { status: 400 },
    );
  }

  if (!TRACKS[parsed.track as TrackId]) {
    return Response.json({ error: "Track tidak valid" }, { status: 400 });
  }

  const missing = await validateProblemIds(parsed.problemIds);
  if (missing.length) {
    return Response.json(
      {
        error: `Soal tidak ditemukan: ${missing.slice(0, 8).join(", ")}${
          missing.length > 8 ? "…" : ""
        }`,
      },
      { status: 400 },
    );
  }

  const id = `mock-${nanoid(10)}`;
  const db = await getDb();
  await db.insert(generatedMocks).values({
    id,
    createdBy: authResult.user.id,
    title: parsed.title.trim(),
    description: parsed.description.trim(),
    durationMinutes: parsed.durationMinutes,
    difficultyMode: parsed.difficultyMode,
    problemIds: parsed.problemIds,
    track: parsed.track,
    kind: parsed.kind,
    penaltyEnabled: parsed.penaltyEnabled ?? true,
    penaltyMinutesPerWrong: parsed.penaltyMinutesPerWrong ?? 20,
  });

  const mock = await resolvePracticeMock(id);
  return Response.json({ mock }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const body = await req.json();
  const id = String(body.id || "").trim();
  if (!id) {
    return Response.json({ error: "id wajib" }, { status: 400 });
  }

  if (body.restore === true || body.hidden === false) {
    const override = await getMockOverride(id);
    const isCurated = curatedMockIds().has(id);
    if (!isCurated) {
      const db = await getDb();
      const existing = await db.query.generatedMocks.findFirst({
        where: eq(generatedMocks.id, id),
      });
      if (!existing && !override) {
        return Response.json(
          { error: "Simulasi tidak ditemukan" },
          { status: 404 },
        );
      }
    } else if (!getMock(id) && !override) {
      return Response.json(
        { error: "Simulasi tidak ditemukan" },
        { status: 404 },
      );
    }

    if (override?.payload) {
      await upsertMockOverride({
        id,
        payload: override.payload,
        hidden: false,
        updatedBy: authResult.user.id,
      });
    } else {
      await deleteMockOverride(id);
    }
    const mock = await resolvePracticeMock(id);
    return Response.json({
      mock,
      restored: true,
      hidden: false,
      source: isCurated ? "curated" : "ai",
    });
  }

  if (body.hidden === true) {
    const isCurated = curatedMockIds().has(id);
    if (!isCurated) {
      const db = await getDb();
      const existing = await db.query.generatedMocks.findFirst({
        where: eq(generatedMocks.id, id),
      });
      if (!existing) {
        return Response.json(
          { error: "Simulasi tidak ditemukan" },
          { status: 404 },
        );
      }
    } else if (!getMock(id)) {
      return Response.json(
        { error: "Simulasi tidak ditemukan" },
        { status: 404 },
      );
    }
    await upsertMockOverride({
      id,
      hidden: true,
      updatedBy: authResult.user.id,
    });
    return Response.json({
      ok: true,
      hidden: true,
      source: isCurated ? "curated" : "ai",
    });
  }

  let parsed: z.infer<typeof mockBodySchema>;
  try {
    parsed = mockBodySchema.parse(body);
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Payload tidak valid",
      },
      { status: 400 },
    );
  }

  const missing = await validateProblemIds(parsed.problemIds);
  if (missing.length) {
    return Response.json(
      {
        error: `Soal tidak ditemukan: ${missing.slice(0, 8).join(", ")}${
          missing.length > 8 ? "…" : ""
        }`,
      },
      { status: 400 },
    );
  }

  const payload = toPayload(parsed);

  if (curatedMockIds().has(id)) {
    await upsertMockOverride({
      id,
      payload,
      hidden: false,
      updatedBy: authResult.user.id,
    });
    const mock = await resolvePracticeMock(id);
    return Response.json({ mock, source: "curated" });
  }

  const db = await getDb();
  const existing = await db.query.generatedMocks.findFirst({
    where: eq(generatedMocks.id, id),
  });
  if (!existing) {
    return Response.json(
      { error: "Simulasi AI tidak ditemukan" },
      { status: 404 },
    );
  }

  await db
    .update(generatedMocks)
    .set({
      title: payload.title,
      description: payload.description,
      durationMinutes: payload.durationMinutes,
      problemIds: payload.problemIds,
      track: payload.track ?? existing.track,
      difficultyMode: payload.difficultyMode ?? existing.difficultyMode,
      kind: parsed.kind,
      penaltyEnabled: parsed.penaltyEnabled ?? existing.penaltyEnabled,
      penaltyMinutesPerWrong:
        parsed.penaltyMinutesPerWrong ?? existing.penaltyMinutesPerWrong,
    })
    .where(eq(generatedMocks.id, id));

  const override = await getMockOverride(id);
  if (override?.hidden || override?.payload) {
    await deleteMockOverride(id);
  }

  const mock = await resolvePracticeMock(id);
  return Response.json({ mock, source: "ai" });
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return Response.json({ error: "id wajib" }, { status: 400 });
  }

  const permanent = url.searchParams.get("permanent") === "1";
  const isCurated = curatedMockIds().has(id);

  if (!permanent) {
    if (isCurated) {
      if (!getMock(id)) {
        return Response.json(
          { error: "Simulasi tidak ditemukan" },
          { status: 404 },
        );
      }
    } else {
      const db = await getDb();
      const existing = await db.query.generatedMocks.findFirst({
        where: eq(generatedMocks.id, id),
      });
      if (!existing) {
        return Response.json(
          { error: "Simulasi tidak ditemukan" },
          { status: 404 },
        );
      }
    }
    await upsertMockOverride({
      id,
      hidden: true,
      updatedBy: authResult.user.id,
    });
    return Response.json({
      ok: true,
      hidden: true,
      source: isCurated ? "curated" : "ai",
    });
  }

  if (isCurated) {
    return Response.json(
      {
        error:
          "Simulasi curated tidak bisa dihapus permanen — gunakan sembunyikan",
      },
      { status: 400 },
    );
  }

  const db = await getDb();
  const existing = await db.query.generatedMocks.findFirst({
    where: eq(generatedMocks.id, id),
  });
  if (!existing) {
    return Response.json({ error: "Simulasi tidak ditemukan" }, { status: 404 });
  }

  await db.delete(generatedMocks).where(eq(generatedMocks.id, id));
  await deleteMockOverride(id);
  return Response.json({ ok: true, deleted: true, source: "ai" });
}
