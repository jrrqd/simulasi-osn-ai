import { NextRequest } from "next/server";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { requireApiUser, rateLimit } from "@/lib/api";
import {
  PRACTICE_ASSISTANT_SYSTEM_PROMPT,
  createUserProvider,
} from "@/lib/ai/provider";
import { getEffectiveAiSettings } from "@/lib/ai/settings";
import { getLessons, getProblems } from "@/lib/content/load";
import { resolveProblem } from "@/lib/content/shared";
import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";
import { labelDifficultyBand } from "@/lib/ai/difficulty";

async function buildPracticeContext(input: {
  problemId?: string;
  track?: string;
  topic?: string;
}) {
  if (input.problemId) {
    const problem = await resolveProblem(input.problemId);
    if (problem) {
      const lesson = getLessons().find(
        (l) => l.topic === problem.topic && l.track === problem.track,
      );
      const stemPreview = problem.stem.slice(0, 2800);
      return `Siswa sedang mengerjakan side quest / soal latihan (JANGAN berikan kunci jawaban atau solusi lengkap).

Soal:
- ID: ${problem.id}
- Judul: ${problem.title}
- Track: ${problem.track} (${TRACKS[problem.track as TrackId]?.name ?? problem.track})
- Topik: ${problem.topic} (${TOPIC_LABELS[problem.topic] ?? problem.topic})
- Tingkat: ${labelDifficultyBand(problem.difficulty)} (D${problem.difficulty})
- Tipe jawaban: ${problem.answerType}
- Sumber: ${problem.source ?? "curated"}
${lesson ? `- Modul tutorial terkait: ${lesson.title} (/study/${lesson.id})` : ""}

Teks soal (stem):
${stemPreview}

Petunjuk untukmu: bantu dengan hint bertahap dan konsep terkait saja.`;
    }
    return `Siswa membuka halaman soal latihan dengan id "${input.problemId}", tetapi soal belum tersedia di server (mungkin masih loading dari generate AI). Bantu secara umum tentang cara mengerjakan side quest dan konsep track B/C jika relevan.`;
  }

  const track =
    input.track && TRACKS[input.track as TrackId]
      ? (input.track as TrackId)
      : undefined;
  const topic = input.topic?.trim() || undefined;

  const curated = getProblems().filter((p) => {
    if (track && p.track !== track) return false;
    if (topic && p.topic !== topic) return false;
    return true;
  });

  const sample = curated
    .slice(0, 12)
    .map(
      (p) =>
        `- ${p.title} (${p.track} · ${TOPIC_LABELS[p.topic] ?? p.topic} · ${labelDifficultyBand(p.difficulty)})`,
    )
    .join("\n");

  const lesson = topic
    ? getLessons().find(
        (l) => l.topic === topic && (!track || l.track === track),
      )
    : undefined;

  const filterLine = [
    track ? `Track ${track} (${TRACKS[track].name})` : "Semua track",
    topic
      ? `topik ${TOPIC_LABELS[topic] ?? topic}`
      : "semua topik",
  ].join(" · ");

  return `Siswa berada di halaman daftar Latihan (side quests).
Filter aktif: ${filterLine}.
${lesson ? `Modul tutorial terkait filter: ${lesson.title} (/study/${lesson.id}).` : ""}

Contoh soal curated yang terlihat (sampel):
${sample || "(tidak ada soal curated untuk filter ini)"}

Bantu siswa memilih soal, memahami topik, atau merencanakan generate tantangan AI (standar / custom topik).`;
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`practice-assistant:${authResult.user.id}`, 40)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const messages = body.messages as UIMessage[];
  const problemId =
    typeof body.problemId === "string" && body.problemId
      ? body.problemId
      : undefined;
  const track =
    typeof body.track === "string" && body.track ? body.track : undefined;
  const topic =
    typeof body.topic === "string" && body.topic ? body.topic : undefined;

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

  const context = await buildPracticeContext({ problemId, track, topic });
  const result = streamText({
    model,
    system: `${PRACTICE_ASSISTANT_SYSTEM_PROMPT}\n\n${context}`,
    messages: await convertToModelMessages(messages),
    abortSignal: AbortSignal.timeout(180_000),
  });

  return result.toUIMessageStreamResponse();
}
