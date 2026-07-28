import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { generatedProblems } from "@/db/schema";
import { requireApiAdmin } from "@/lib/api";
import {
  generatedProblemSchema,
  normalizeGeneratedProblem,
} from "@/lib/ai/provider";
import { getProblem } from "@/lib/content/load";
import {
  curatedProblemIds,
  deleteProblemOverride,
  getProblemOverride,
  listAdminPracticeProblems,
  resolvePracticeProblem,
  upsertProblemOverride,
} from "@/lib/content/problem-library";
import type { Problem, TrackId } from "@/lib/content/types";
import { TRACKS } from "@/lib/content/types";

function parseProblemBody(body: unknown): Problem {
  const normalized = normalizeGeneratedProblem(
    generatedProblemSchema.parse(body),
  );
  const difficulty = Math.min(
    5,
    Math.max(1, Math.round(normalized.difficulty)),
  ) as 1 | 2 | 3 | 4 | 5;
  const { figures: _figures, ...rest } = normalized;
  return {
    ...rest,
    id: typeof (body as { id?: string }).id === "string"
      ? (body as { id: string }).id
      : `admin-${nanoid(10)}`,
    difficulty,
    source: "ai",
  };
}

export async function GET(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const problem = await resolvePracticeProblem(id);
    if (!problem) {
      // Still allow editing hidden curated via override/base
      const curated = getProblem(id);
      const override = await getProblemOverride(id);
      if (!curated && !override) {
        return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
      }
      if (override?.hidden && curated) {
        return Response.json({
          problem: override.payload
            ? { ...override.payload, id }
            : curated,
          source: "curated" as const,
          hidden: true,
        });
      }
      return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
    }
    const source = curatedProblemIds().has(id) ? "curated" : "ai";
    const override = await getProblemOverride(id);
    return Response.json({
      problem,
      source,
      hidden: Boolean(override?.hidden),
    });
  }

  const result = await listAdminPracticeProblems({
    track: url.searchParams.get("track") || undefined,
    topic: url.searchParams.get("topic") || undefined,
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

  const body = await req.json();
  let problem: Problem;
  try {
    problem = parseProblemBody(body);
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Payload soal tidak valid",
      },
      { status: 400 },
    );
  }

  if (!TRACKS[problem.track as TrackId]) {
    return Response.json({ error: "Track tidak valid" }, { status: 400 });
  }
  if (!TRACKS[problem.track as TrackId].topics.includes(problem.topic)) {
    return Response.json(
      { error: `Topic tidak ada di track ${problem.track}` },
      { status: 400 },
    );
  }

  const id = `ai-${nanoid(10)}`;
  problem = {
    ...problem,
    id,
    source: "ai",
    tags: [...new Set([...(problem.tags ?? []), "admin-created"])],
  };

  const db = await getDb();
  await db.insert(generatedProblems).values({
    id,
    userId: authResult.user.id,
    payload: problem,
    track: problem.track,
    topic: problem.topic,
    difficulty: problem.difficulty,
    difficultyMode: "medium",
    title: problem.title,
  });

  return Response.json({ problem }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const body = await req.json();
  const id = String(body.id || "").trim();
  if (!id) {
    return Response.json({ error: "id wajib" }, { status: 400 });
  }

  const restore = body.restore === true;
  if (restore || body.hidden === false) {
    const override = await getProblemOverride(id);
    const isCurated = curatedProblemIds().has(id);
    if (!isCurated) {
      const db = await getDb();
      const existing = await db.query.generatedProblems.findFirst({
        where: eq(generatedProblems.id, id),
      });
      if (!existing && !override) {
        return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
      }
    } else if (!getProblem(id) && !override) {
      return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
    }

    if (override?.payload) {
      await upsertProblemOverride({
        id,
        payload: override.payload,
        hidden: false,
        updatedBy: authResult.user.id,
      });
    } else {
      await deleteProblemOverride(id);
    }
    const problem = await resolvePracticeProblem(id);
    return Response.json({
      problem,
      restored: true,
      hidden: false,
      source: isCurated ? "curated" : "ai",
    });
  }

  if (body.hidden === true) {
    const isCurated = curatedProblemIds().has(id);
    if (!isCurated) {
      const db = await getDb();
      const existing = await db.query.generatedProblems.findFirst({
        where: eq(generatedProblems.id, id),
      });
      if (!existing) {
        return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
      }
    } else if (!getProblem(id)) {
      return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
    }
    await upsertProblemOverride({
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

  let parsed: ReturnType<typeof normalizeGeneratedProblem>;
  try {
    parsed = normalizeGeneratedProblem(
      generatedProblemSchema.parse({ ...body, id: undefined }),
    );
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Payload soal tidak valid",
      },
      { status: 400 },
    );
  }

  const difficulty = Math.min(
    5,
    Math.max(1, Math.round(parsed.difficulty)),
  ) as 1 | 2 | 3 | 4 | 5;

  const { figures: _figures, ...rest } = parsed;
  const next: Problem = {
    ...rest,
    id,
    difficulty,
    source: curatedProblemIds().has(id) ? "curated" : "ai",
  };

  if (curatedProblemIds().has(id)) {
    await upsertProblemOverride({
      id,
      payload: next,
      hidden: false,
      updatedBy: authResult.user.id,
    });
    return Response.json({ problem: next, source: "curated" });
  }

  const db = await getDb();
  const existing = await db.query.generatedProblems.findFirst({
    where: eq(generatedProblems.id, id),
  });
  if (!existing) {
    return Response.json({ error: "Soal AI tidak ditemukan" }, { status: 404 });
  }

  await db
    .update(generatedProblems)
    .set({
      payload: next,
      track: next.track,
      topic: next.topic,
      difficulty: next.difficulty,
      title: next.title,
    })
    .where(eq(generatedProblems.id, id));

  // Unhide if previously soft-hidden
  const override = await getProblemOverride(id);
  if (override?.hidden) {
    await upsertProblemOverride({
      id,
      payload: null,
      hidden: false,
      updatedBy: authResult.user.id,
    });
  }

  return Response.json({ problem: next, source: "ai" });
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
  const isCurated = curatedProblemIds().has(id);

  if (!permanent) {
    if (isCurated) {
      if (!getProblem(id)) {
        return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
      }
    } else {
      const db = await getDb();
      const existing = await db.query.generatedProblems.findFirst({
        where: eq(generatedProblems.id, id),
      });
      if (!existing) {
        return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
      }
    }
    await upsertProblemOverride({
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
      { error: "Soal curated tidak bisa dihapus permanen — gunakan sembunyikan" },
      { status: 400 },
    );
  }

  const db = await getDb();
  const existing = await db.query.generatedProblems.findFirst({
    where: eq(generatedProblems.id, id),
  });
  if (!existing) {
    return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
  }

  await db.delete(generatedProblems).where(eq(generatedProblems.id, id));
  await deleteProblemOverride(id);
  return Response.json({ ok: true, deleted: true, source: "ai" });
}
