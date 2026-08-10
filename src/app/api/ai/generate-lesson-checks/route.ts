import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { topicMastery } from "@/db/schema";
import { requireApiUser, rateLimitForUser } from "@/lib/api";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import { generateLessonChecks } from "@/lib/ai/generate-lesson-checks";
import { getLesson } from "@/lib/content/load";
import { getLessonCheckQuestions } from "@/lib/lesson-checks";

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;

  if (
    !(await rateLimitForUser(
      authResult.user.id,
      "gen-checks",
      8,
      60 * 60_000,
    ))
  ) {
    return Response.json(
      { error: "Batas generate cek konsep: 8 per jam" },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const lessonId = String(body.lessonId ?? "").trim();
  if (!lessonId) {
    return Response.json({ error: "lessonId wajib" }, { status: 400 });
  }

  const lesson = getLesson(lessonId);
  if (!lesson) {
    return Response.json({ error: "Modul tidak ditemukan" }, { status: 404 });
  }

  const settings = await getEffectiveAiSettings(authResult.user.id);
  if (!settings?.apiKey) {
    return Response.json(
      { error: "AI provider belum dikonfigurasi" },
      { status: 400 },
    );
  }

  const db = await getDb();
  const topicRows = await db
    .select()
    .from(topicMastery)
    .where(eq(topicMastery.userId, authResult.user.id));
  const topicRow = topicRows.find((r) => r.topic === lesson.topic);

  try {
    const checks = await generateLessonChecks({
      lesson,
      userId: authResult.user.id,
      mastery: topicRow?.mastery ?? 0,
      count: Number(body.count) || 4,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      modelId: settings.modelId,
    });
    const all = await getLessonCheckQuestions(lessonId);
    return Response.json({ checks, allChecks: all });
  } catch (e) {
    console.error("[generate-lesson-checks]", e);
    return Response.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Gagal menghasilkan cek konsep",
      },
      { status: 500 },
    );
  }
}
