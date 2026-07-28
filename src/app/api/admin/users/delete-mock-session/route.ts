import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { attempts, mockSessions, topicMastery, user } from "@/db/schema";
import { rateLimit, requireApiAdmin } from "@/lib/api";

const deleteBodySchema = z.object({
  userId: z.string().min(1),
  mockSessionId: z.string().min(1),
  behavior: z.enum(["hard_delete", "soft_abandon"]),
  confirm: z.literal(true),
});

type Counts = {
  mockSessions: number;
  attempts: number;
  topicMastery: number;
  abandoned: number;
};

export async function POST(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  if (!rateLimit("admin-delete-mock-session", 30, 60_000)) {
    return Response.json(
      { error: "Terlalu banyak permintaan, coba lagi nanti" },
      { status: 429 },
    );
  }

  let parsed: z.infer<typeof deleteBodySchema>;
  try {
    parsed = deleteBodySchema.parse(await req.json());
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

  const session = await db.query.mockSessions.findFirst({
    where: and(
      eq(mockSessions.id, parsed.mockSessionId),
      eq(mockSessions.userId, parsed.userId),
    ),
  });
  if (!session) {
    return Response.json(
      { error: "Sesi tidak ditemukan untuk siswa ini" },
      { status: 404 },
    );
  }

  const counts: Counts = {
    mockSessions: 0,
    attempts: 0,
    topicMastery: 0,
    abandoned: 0,
  };

  await db.transaction(async (tx) => {
    if (parsed.behavior === "soft_abandon") {
      const abandoned = await tx
        .update(mockSessions)
        .set({ status: "abandoned" })
        .where(
          and(
            eq(mockSessions.id, parsed.mockSessionId),
            eq(mockSessions.userId, parsed.userId),
          ),
        )
        .returning();
      counts.abandoned = abandoned.length;
      counts.mockSessions = abandoned.length;
      return;
    }

    if (session.status === "submitted") {
      const deletedAttempts = await tx
        .delete(attempts)
        .where(eq(attempts.mockSessionId, parsed.mockSessionId))
        .returning();
      counts.attempts = deletedAttempts.length;
    }

    const deletedMastery = await tx
      .delete(topicMastery)
      .where(eq(topicMastery.userId, parsed.userId))
      .returning();
    counts.topicMastery = deletedMastery.length;

    const deleted = await tx
      .delete(mockSessions)
      .where(
        and(
          eq(mockSessions.id, parsed.mockSessionId),
          eq(mockSessions.userId, parsed.userId),
        ),
      )
      .returning();
    if (deleted.length === 0) {
      throw new Error("Sesi sudah dihapus atau tidak ditemukan");
    }
    counts.mockSessions = deleted.length;
  });

  console.info(
    `[admin] delete-mock-session admin=${authResult.user.id} target=${parsed.userId} session=${parsed.mockSessionId} behavior=${parsed.behavior} counts=${JSON.stringify(counts)}`,
  );

  return Response.json({ ok: true, counts });
}
