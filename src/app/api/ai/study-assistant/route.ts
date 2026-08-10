import { NextRequest } from "next/server";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { requireApiUser, rateLimitForUser } from "@/lib/api";
import {
  STUDY_ASSISTANT_SYSTEM_PROMPT,
  createUserProvider,
} from "@/lib/ai/provider";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import { getLesson, getLessons } from "@/lib/content/load";
import { TOPIC_LABELS, TRACKS } from "@/lib/content/types";

function buildLessonContext(lessonId?: string) {
  if (lessonId) {
    const lesson = getLesson(lessonId);
    if (lesson) {
      return `Modul yang sedang dipelajari siswa:
Track: ${lesson.track} (${TRACKS[lesson.track].name})
Topic: ${lesson.topic} (${TOPIC_LABELS[lesson.topic] ?? lesson.topic})
Judul: ${lesson.title}
Ringkasan: ${lesson.summary}

Materi:
${lesson.body.slice(0, 3500)}`;
    }
  }

  const overview = Object.entries(TRACKS)
    .map(([id, meta]) => {
      const topics = getLessons()
        .filter((l) => l.track === id)
        .map((l) => `- ${l.title} (${l.topic})`)
        .join("\n");
      return `Track ${id}. ${meta.name}: ${meta.description}\n${topics}`;
    })
    .join("\n\n");

  return `Siswa berada di halaman daftar modul Belajar. Silabus tersedia:\n\n${overview}`;
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!(await rateLimitForUser(authResult.user.id, "study-assistant", 40))) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const messages = body.messages as UIMessage[];
  const lessonId =
    typeof body.lessonId === "string" && body.lessonId
      ? body.lessonId
      : undefined;

  const settings = await getEffectiveAiSettings(authResult.user.id);
  if (!settings) {
    return Response.json(
      {
        error:
          "AI belum tersedia. Gunakan API key pribadi di Pengaturan atau hubungi admin.",
      },
      { status: 400 },
    );
  }

  const model = createUserProvider({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    modelId: settings.modelId,
  });

  const context = buildLessonContext(lessonId);
  const result = streamText({
    model,
    system: `${STUDY_ASSISTANT_SYSTEM_PROMPT}\n\n${context}`,
    messages: await convertToModelMessages(messages),
    abortSignal: AbortSignal.timeout(180_000),
  });

  return result.toUIMessageStreamResponse();
}
