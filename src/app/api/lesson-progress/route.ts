import { requireApiUser } from "@/lib/api";
import {
  getUserLessonProgress,
  upsertLessonProgress,
} from "@/lib/lesson-progress";
import { getLesson } from "@/lib/content/load";

export async function GET(req: Request) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;

  const map = await getUserLessonProgress(authResult.user.id);
  const progress = Object.fromEntries(
    [...map.entries()].map(([lessonId, row]) => [
      lessonId,
      {
        lessonId: row.lessonId,
        status: row.status,
        checksPassed: row.checksPassed,
        completedAt: row.completedAt,
        updatedAt: row.updatedAt,
      },
    ]),
  );

  return Response.json({ progress });
}

export async function POST(req: Request) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;

  const body = (await req.json().catch(() => null)) as {
    lessonId?: unknown;
    checksPassed?: unknown;
    complete?: unknown;
  } | null;

  if (!body || typeof body.lessonId !== "string" || !body.lessonId.trim()) {
    return Response.json({ error: "lessonId wajib" }, { status: 400 });
  }

  if (!getLesson(body.lessonId)) {
    return Response.json({ error: "Modul tidak ditemukan" }, { status: 404 });
  }

  let checksPassed: Record<string, boolean> | undefined;
  if (body.checksPassed != null) {
    if (
      typeof body.checksPassed !== "object" ||
      Array.isArray(body.checksPassed)
    ) {
      return Response.json({ error: "checksPassed tidak valid" }, { status: 400 });
    }
    checksPassed = {};
    for (const [k, v] of Object.entries(
      body.checksPassed as Record<string, unknown>,
    )) {
      if (typeof v === "boolean") checksPassed[k] = v;
    }
  }

  try {
    const row = await upsertLessonProgress({
      userId: authResult.user.id,
      lessonId: body.lessonId,
      checksPassed,
      complete: body.complete === true,
    });
    return Response.json({ progress: row });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Gagal menyimpan" },
      { status: 400 },
    );
  }
}
