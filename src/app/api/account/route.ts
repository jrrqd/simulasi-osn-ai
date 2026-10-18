import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  aiProviderSettings,
  attempts,
  checkAttempts,
  lessonProgress,
  mockSessions,
  user,
} from "@/db/schema";
import { requireApiUser, rateLimit } from "@/lib/api";

export async function GET(req: Request) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`account-get:${authResult.user.id}`, 20, 60_000)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const db = await getDb();
  const userId = authResult.user.id;
  const [profile, attemptRows, mockRows, lessonRows, checkRows, provider] =
    await Promise.all([
      db.query.user.findFirst({ where: eq(user.id, userId) }),
      db.select().from(attempts).where(eq(attempts.userId, userId)),
      db.select().from(mockSessions).where(eq(mockSessions.userId, userId)),
      db.select().from(lessonProgress).where(eq(lessonProgress.userId, userId)),
      db.select().from(checkAttempts).where(eq(checkAttempts.userId, userId)),
      db.query.aiProviderSettings.findFirst({
        where: eq(aiProviderSettings.userId, userId),
        columns: { baseUrl: true, modelId: true },
      }),
    ]);

  if (!profile) {
    return Response.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  return Response.json({
    exportedAt: new Date().toISOString(),
    profile: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      birthDate: profile.birthDate,
      schoolName: profile.schoolName,
      grade: profile.grade,
      city: profile.city,
      phase: profile.phase,
      userType: profile.userType,
      vipExpiresAt: profile.vipExpiresAt,
      createdAt: profile.createdAt,
    },
    aiProvider: provider
      ? { baseUrl: provider.baseUrl, modelId: provider.modelId, hasApiKey: true }
      : null,
    attempts: attemptRows,
    mockSessions: mockRows,
    lessonProgress: lessonRows,
    checkAttempts: checkRows,
  });
}

export async function DELETE(req: Request) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`account-delete:${authResult.user.id}`, 5, 60_000)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  const db = await getDb();
  const profile = await db.query.user.findFirst({
    where: eq(user.id, authResult.user.id),
  });
  if (!profile) {
    return Response.json({ error: "User tidak ditemukan" }, { status: 404 });
  }
  if (profile.role === "admin") {
    return Response.json(
      { error: "Akun admin tidak dapat dihapus dari sini." },
      { status: 400 },
    );
  }
  if (!email || email !== profile.email.toLowerCase()) {
    return Response.json(
      { error: "Ketik email akun untuk menghapus data." },
      { status: 400 },
    );
  }

  await db.delete(user).where(eq(user.id, profile.id));
  return Response.json({ ok: true });
}
