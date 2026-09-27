import { NextRequest } from "next/server";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { requireApiUser, rateLimitForUser } from "@/lib/api";
import { assertApiFeature } from "@/lib/access/assert";
import { reserveAssistantChat } from "@/lib/ai/assistant-quota";
import { TEACH_ME_SESSION_SKILL } from "@/lib/ai/skills/teach-chat";
import {
  loadTeachingMemoryContext,
  persistLearningRecordFromAssistantText,
} from "@/lib/ai/teaching-memory";
import { loadUserAccess } from "@/lib/user/load-user-access";
import {
  TEACH_ME_SYSTEM_PROMPT,
  createUserProvider,
} from "@/lib/ai/provider";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import { getLesson, getLessons } from "@/lib/content/load";
import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";

function buildTeachContext(input: {
  lessonId?: string;
  topic?: string;
  track?: string;
}) {
  if (input.lessonId) {
    const lesson = getLesson(input.lessonId);
    if (lesson) {
      return `Modul fokus Teach me:
Track: ${lesson.track} (${TRACKS[lesson.track].name})
Topic: ${lesson.topic} (${TOPIC_LABELS[lesson.topic] ?? lesson.topic})
Judul: ${lesson.title}
Ringkasan: ${lesson.summary}

Materi (cuplikan):
${lesson.body.slice(0, 4000)}`;
    }
  }

  if (input.topic) {
    const related = getLessons()
      .filter((l) => l.topic === input.topic)
      .slice(0, 4);
    const topicLabel = TOPIC_LABELS[input.topic] ?? input.topic;
    const blocks =
      related.length > 0
        ? related
            .map(
              (l) =>
                `### ${l.title} (${l.id})\n${l.summary}\n${l.body.slice(0, 1200)}`,
            )
            .join("\n\n")
        : "(Belum ada modul untuk topik ini.)";
    return `Topik fokus Teach me: ${topicLabel} (${input.topic})
${input.track && input.track in TRACKS ? `Track: ${input.track} (${TRACKS[input.track as TrackId].name})` : ""}

Modul terkait:
${blocks}`;
  }

  const overview = Object.entries(TRACKS)
    .map(([id, meta]) => {
      const topics = meta.topics
        .map((t) => `- ${TOPIC_LABELS[t] ?? t} (${t})`)
        .join("\n");
      return `Track ${id}. ${meta.name}: ${meta.description}\n${topics}`;
    })
    .join("\n\n");

  return `Siswa membuka Teach me tanpa modul spesifik. Silabus track A–D:\n\n${overview}`;
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  const featureDenied = await assertApiFeature(
    authResult.user.id,
    "ai_assistant",
  );
  if (featureDenied) return featureDenied;
  if (!(await rateLimitForUser(authResult.user.id, "teach-assistant", 40))) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const messages = body.messages as UIMessage[];
  const lessonId =
    typeof body.lessonId === "string" && body.lessonId
      ? body.lessonId
      : undefined;
  const topic =
    typeof body.topic === "string" && body.topic ? body.topic : undefined;
  const track =
    typeof body.track === "string" && body.track ? body.track : undefined;
  const mission =
    typeof body.mission === "string" && body.mission.trim()
      ? body.mission.trim().slice(0, 400)
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

  const access = await loadUserAccess(authResult.user.id);
  if (!access) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const quotaDenied = await reserveAssistantChat(
    authResult.user.id,
    "teach",
    access,
    settings,
  );
  if (quotaDenied) return quotaDenied;

  const model = createUserProvider({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    modelId: settings.modelId,
  });

  const lesson = lessonId ? getLesson(lessonId) : undefined;
  const topicHint = lesson?.topic ?? topic;
  const [context, memory] = await Promise.all([
    Promise.resolve(buildTeachContext({ lessonId, topic, track })),
    loadTeachingMemoryContext(authResult.user.id, {
      lessonId,
      topicHint,
      mission,
    }),
  ]);

  const result = streamText({
    model,
    system: `${TEACH_ME_SYSTEM_PROMPT}\n\n${TEACH_ME_SESSION_SKILL}\n\n${context}\n\n${memory}`,
    messages: await convertToModelMessages(messages),
    abortSignal: AbortSignal.timeout(180_000),
    async onFinish({ text }) {
      try {
        await persistLearningRecordFromAssistantText({
          userId: authResult.user.id,
          source: "teach",
          text,
          lessonId,
          topicFallback: topicHint,
        });
      } catch (err) {
        console.warn("[teach-assistant] learning record persist skipped:", err);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
