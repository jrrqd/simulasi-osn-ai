import { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api";
import { getLessons } from "@/lib/content/load";
import {
  getLessonCheckQuestions,
  listGeneratedLessonChecks,
  setGeneratedCheckHidden,
  upsertGeneratedCheck,
} from "@/lib/lesson-checks";
import { normalizeCheckQuestion } from "@/lib/content/load";
import { TOPIC_LABELS } from "@/lib/content/types";

export async function GET(req: NextRequest) {
  const auth = await requireApiAdmin(req);
  if ("error" in auth) return auth.error;

  const lessons = getLessons();
  const generated = await listGeneratedLessonChecks({ includeHidden: true });
  const byLesson = new Map<string, typeof generated>();
  for (const row of generated) {
    const list = byLesson.get(row.lessonId) ?? [];
    list.push(row);
    byLesson.set(row.lessonId, list);
  }

  const items = await Promise.all(
    lessons.map(async (lesson) => {
      const checks = await getLessonCheckQuestions(lesson.id);
      const extras = byLesson.get(lesson.id) ?? [];
      return {
        id: lesson.id,
        title: lesson.title,
        track: lesson.track,
        topic: lesson.topic,
        topicLabel: TOPIC_LABELS[lesson.topic] ?? lesson.topic,
        curatedCount: lesson.checkQuestions.length,
        visibleCount: checks.length,
        generatedCount: extras.filter((e) => !e.hidden).length,
        hiddenGeneratedCount: extras.filter((e) => e.hidden).length,
        checks,
        generated: extras.map((e) => ({
          id: e.id,
          hidden: e.hidden,
          payload: e.payload,
          updatedAt: e.updatedAt,
        })),
      };
    }),
  );

  return Response.json({ items });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiAdmin(req);
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "hide" || action === "restore") {
    const id = String(body.id ?? "");
    if (!id) {
      return Response.json({ error: "id wajib" }, { status: 400 });
    }
    const row = await setGeneratedCheckHidden(id, action === "hide");
    if (!row) {
      return Response.json({ error: "Cek konsep tidak ditemukan" }, { status: 404 });
    }
    return Response.json({ ok: true, row });
  }

  if (action === "upsert") {
    const lessonId = String(body.lessonId ?? "");
    const question = normalizeCheckQuestion(body.question);
    if (!lessonId || !question) {
      return Response.json({ error: "lessonId + question wajib" }, { status: 400 });
    }
    const row = await upsertGeneratedCheck({
      lessonId,
      question: { ...question, source: question.source ?? "admin" },
      createdBy: auth.user.id,
      id: question.id,
    });
    return Response.json({ ok: true, row });
  }

  return Response.json({ error: "action tidak dikenal" }, { status: 400 });
}
