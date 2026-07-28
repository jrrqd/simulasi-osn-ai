import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  attempts,
  lessonProgress,
  mockSessions,
  topicMastery,
  user,
} from "@/db/schema";
import { rateLimit, requireApiAdmin } from "@/lib/api";

const resetBodySchema = z.object({
  userId: z.string().min(1),
  scope: z.enum(["in_progress_only", "all_mocks", "full_reset"]),
  behavior: z.enum(["hard_delete", "soft_abandon"]),
  confirm: z.literal(true),
});

type Counts = {
  mockSessions: number;
  attempts: number;
  topicMastery: number;
  lessonProgress: number;
  abandoned: number;
};

export async function POST(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  if (!rateLimit("admin-reset-mock-sessions", 10, 60_000)) {
    return Response.json(
      { error: "Terlalu banyak permintaan, coba lagi nanti" },
      { status: 429 },
    );
  }

  let parsed: z.infer<typeof resetBodySchema>;
  try {
    parsed = resetBodySchema.parse(await req.json());
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Payload tidak valid",
      },
      { status: 400 },
    );
  }

  if (parsed.userId === authResult.user.id) {
    return Response.json(
      { error: "Admin tidak dapat mereset data dirinya sendiri" },
      { status: 400 },
    );
  }

  if (parsed.scope === "full_reset" && parsed.behavior === "soft_abandon") {
    return Response.json(
      {
        error:
          "Full reset harus berupa hard_delete. Soft-abandon tidak menghapus data.",
      },
      { status: 400 },
    );
  }

  const db = await getDb();
  const target = await db.query.user.findFirst({
    where: eq(user.id, parsed.userId),
  });
  if (!target) {
    return Response.json({ error: "User tidak ditemukan" }, { status: 404 });
  }
  if (target.role === "admin") {
    return Response.json(
      { error: "Tidak dapat mereset data admin lain" },
      { status: 400 },
    );
  }

  const counts: Counts = {
    mockSessions: 0,
    attempts: 0,
    topicMastery: 0,
    lessonProgress: 0,
    abandoned: 0,
  };

  await db.transaction(async (tx) => {
    if (parsed.behavior === "soft_abandon") {
      const abandoned = await tx
        .update(mockSessions)
        .set({ status: "abandoned" })
        .where(
          and(
            eq(mockSessions.userId, parsed.userId),
            eq(mockSessions.status, "in_progress"),
          ),
        )
        .returning();
      counts.abandoned = abandoned.length;
      counts.mockSessions = abandoned.length;
      return;
    }

    if (parsed.scope === "in_progress_only") {
      const deleted = await tx
        .delete(mockSessions)
        .where(
          and(
            eq(mockSessions.userId, parsed.userId),
            eq(mockSessions.status, "in_progress"),
          ),
        )
        .returning();
      counts.mockSessions = deleted.length;
      return;
    }

    const deletedAttempts = await tx
      .delete(attempts)
      .where(eq(attempts.userId, parsed.userId))
      .returning();
    counts.attempts = deletedAttempts.length;

    const deletedMocks = await tx
      .delete(mockSessions)
      .where(eq(mockSessions.userId, parsed.userId))
      .returning();
    counts.mockSessions = deletedMocks.length;

    if (parsed.scope === "full_reset") {
      const deletedMastery = await tx
        .delete(topicMastery)
        .where(eq(topicMastery.userId, parsed.userId))
        .returning();
      counts.topicMastery = deletedMastery.length;

      const deletedLessons = await tx
        .delete(lessonProgress)
        .where(eq(lessonProgress.userId, parsed.userId))
        .returning();
      counts.lessonProgress = deletedLessons.length;
    }
  });

  console.info(
    `[admin] reset-mock-sessions admin=${authResult.user.id} target=${parsed.userId} scope=${parsed.scope} behavior=${parsed.behavior} counts=${JSON.stringify(counts)}`,
  );

  return Response.json({ ok: true, counts });
}