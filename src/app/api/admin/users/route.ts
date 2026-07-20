import { NextRequest } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attempts,
  mockSessions,
  topicMastery,
  user,
} from "@/db/schema";
import { requireApiAdmin } from "@/lib/api";
import { getAuth } from "@/lib/auth";
import { TOPIC_LABELS } from "@/lib/content/types";

function userSummary(
  item: typeof user.$inferSelect,
  allAttempts: (typeof attempts.$inferSelect)[],
  allMocks: (typeof mockSessions.$inferSelect)[],
) {
  const userAttempts = allAttempts.filter((a) => a.userId === item.id);
  const userMocks = allMocks.filter((m) => m.userId === item.id);
  const totalScore = userAttempts.reduce((sum, a) => sum + a.score, 0);
  const totalMax = userAttempts.reduce((sum, a) => sum + a.maxScore, 0);
  const practiceTimeMs = userAttempts.reduce(
    (sum, a) => sum + a.durationMs,
    0,
  );
  const latestAttempt = userAttempts[0]?.createdAt;
  const latestMock = userMocks[0]?.startedAt;
  const lastActiveAt =
    latestAttempt && latestMock
      ? latestAttempt > latestMock
        ? latestAttempt
        : latestMock
      : latestAttempt ?? latestMock ?? item.updatedAt;

  return {
    id: item.id,
    name: item.name,
    email: item.email,
    role: item.role,
    banned: item.banned,
    createdAt: item.createdAt,
    lastActiveAt,
    attemptsCount: userAttempts.length,
    accuracy: totalMax ? totalScore / totalMax : 0,
    practiceTimeMs,
    mocksCompleted: userMocks.filter((m) => m.status === "submitted").length,
  };
}

export async function GET(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const db = await getDb();
  const userId = req.nextUrl.searchParams.get("userId");
  const [users, allAttempts, allMocks] = await Promise.all([
    db.select().from(user).orderBy(asc(user.name)),
    db.select().from(attempts).orderBy(desc(attempts.createdAt)),
    db.select().from(mockSessions).orderBy(desc(mockSessions.startedAt)),
  ]);

  if (!userId) {
    return Response.json({
      users: users.map((item) => userSummary(item, allAttempts, allMocks)),
    });
  }

  const selected = users.find((item) => item.id === userId);
  if (!selected) {
    return Response.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  const userAttempts = allAttempts.filter((a) => a.userId === userId);
  const userMocks = allMocks.filter((m) => m.userId === userId);
  const mastery = await db
    .select()
    .from(topicMastery)
    .where(eq(topicMastery.userId, userId));

  const topicStats = new Map<
    string,
    { attempts: number; score: number; max: number; timeMs: number }
  >();
  const activity = new Map<
    string,
    { attempts: number; timeMs: number; score: number; max: number }
  >();
  for (const attempt of userAttempts) {
    const topic = topicStats.get(attempt.topic) ?? {
      attempts: 0,
      score: 0,
      max: 0,
      timeMs: 0,
    };
    topic.attempts += 1;
    topic.score += attempt.score;
    topic.max += attempt.maxScore;
    topic.timeMs += attempt.durationMs;
    topicStats.set(attempt.topic, topic);

    const dayKey = attempt.createdAt.toISOString().slice(0, 10);
    const day = activity.get(dayKey) ?? {
      attempts: 0,
      timeMs: 0,
      score: 0,
      max: 0,
    };
    day.attempts += 1;
    day.timeMs += attempt.durationMs;
    day.score += attempt.score;
    day.max += attempt.maxScore;
    activity.set(dayKey, day);
  }

  const summary = userSummary(selected, allAttempts, allMocks);
  return Response.json({
    user: summary,
    totals: {
      ...summary,
      totalSessions: userMocks.length,
      completedMocks: userMocks.filter((m) => m.status === "submitted").length,
    },
    topics: Array.from(topicStats, ([topic, stats]) => ({
      topic,
      label: TOPIC_LABELS[topic] ?? topic,
      attempts: stats.attempts,
      accuracy: stats.max ? stats.score / stats.max : 0,
      timeMs: stats.timeMs,
      mastery: mastery.find((m) => m.topic === topic)?.mastery ?? 0,
    })).sort((a, b) => a.mastery - b.mastery),
    activity: Array.from(activity, ([day, stats]) => ({
      day,
      attempts: stats.attempts,
      timeMs: stats.timeMs,
      accuracy: stats.max ? stats.score / stats.max : 0,
    })).sort((a, b) => a.day.localeCompare(b.day)),
    recentAttempts: userAttempts.slice(0, 50).map((a) => ({
      id: a.id,
      problemId: a.problemId,
      topic: a.topic,
      source: a.source,
      score: a.score,
      maxScore: a.maxScore,
      durationMs: a.durationMs,
      createdAt: a.createdAt,
    })),
    mocks: userMocks.map((m) => ({
      id: m.id,
      mockId: m.mockId,
      status: m.status,
      score: m.score,
      maxScore: m.maxScore,
      startedAt: m.startedAt,
      submittedAt: m.submittedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();
  const role = body.role === "admin" ? "admin" : "student";
  if (!email || !name || password.length < 8) {
    return Response.json(
      { error: "Nama, email, dan password minimal 8 karakter wajib diisi" },
      { status: 400 },
    );
  }

  try {
    const auth = await getAuth();
    const created = await auth.api.signUpEmail({
      body: { email, password, name },
    });
    const createdUser = created.user;
    const db = await getDb();
    await db
      .update(user)
      .set({ role, updatedAt: new Date() })
      .where(eq(user.id, createdUser.id));
    return Response.json({ user: { ...createdUser, role } }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Gagal membuat user",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const body = await req.json();
  const userId = String(body.userId ?? "");
  if (!userId) {
    return Response.json({ error: "userId wajib diisi" }, { status: 400 });
  }
  if (userId === authResult.user.id && body.role === "student") {
    return Response.json(
      { error: "Admin tidak dapat menurunkan role dirinya sendiri" },
      { status: 400 },
    );
  }

  const data: Partial<typeof user.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.email === "string" && body.email.trim()) {
    data.email = body.email.trim().toLowerCase();
  }
  if (body.role === "admin" || body.role === "student") {
    data.role = body.role;
  }

  try {
    const db = await getDb();
    const [updated] = await db
      .update(user)
      .set(data)
      .where(eq(user.id, userId))
      .returning();
    if (!updated) {
      return Response.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    if (typeof body.password === "string" && body.password.length >= 8) {
      const auth = await getAuth();
      await auth.api.setUserPassword({
        headers: req.headers,
        body: { userId, newPassword: body.password },
      });
    }
    return Response.json({ user: updated });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Gagal memperbarui user",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return Response.json({ error: "userId wajib diisi" }, { status: 400 });
  }
  if (userId === authResult.user.id) {
    return Response.json(
      { error: "Admin tidak dapat menghapus dirinya sendiri" },
      { status: 400 },
    );
  }

  const auth = await getAuth();
  await auth.api.removeUser({
    headers: req.headers,
    body: { userId },
  });
  return Response.json({ ok: true });
}
