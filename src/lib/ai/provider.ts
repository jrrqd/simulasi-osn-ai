import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  extractJsonMiddleware,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { z } from "zod";

export const generatedProblemSchema = z.object({
  title: z.string().min(3).max(160),
  track: z.enum(["A", "B", "C", "D"]),
  topic: z.string().min(2).max(64),
  difficulty: z.number().int().min(1).max(5),
  answerType: z.enum([
    "numeric",
    "short_string",
    "multi_part",
    "python_output",
    "mcq",
  ]),
  stem: z.string().min(20),
  answer: z.union([z.string(), z.number(), z.array(z.string())]),
  tolerance: z.number().optional(),
  choices: z.array(z.string()).optional(),
  solution: z.string().min(20),
  tags: z.array(z.string()).optional(),
  starterCode: z.string().optional(),
});

export type GeneratedProblemPayload = z.infer<typeof generatedProblemSchema>;

export function createUserProvider(params: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  /** Strip markdown fences for structured (JSON) output parsing. */
  jsonOutput?: boolean;
}) {
  // MiniMax interleaves reasoning into `content` with <think> tags unless
  // reasoning_split is set, which cleanly separates it into reasoning_content.
  let isMiniMax = false;
  try {
    isMiniMax = /(^|\.)minimaxi?\.(io|com)$/.test(
      new URL(params.baseUrl).hostname.toLowerCase(),
    );
  } catch {
    // Invalid URLs fail later in the provider; no special handling here.
  }
  const provider = createOpenAICompatible({
    name: "user-provider",
    baseURL: params.baseUrl.replace(/\/$/, ""),
    apiKey: params.apiKey,
    ...(isMiniMax && {
      transformRequestBody: (body: Record<string, unknown>) => ({
        ...body,
        reasoning_split: true,
      }),
    }),
  });
  // Some reasoning models emit <think>...</think> before the answer; strip it
  // so structured output parsing and chat replies stay clean.
  const middleware = [extractReasoningMiddleware({ tagName: "think" })];
  if (params.jsonOutput) {
    // Models often wrap JSON in markdown fences or leak leading characters
    // into reasoning; slice from the first "{" to the last "}" when possible.
    middleware.push(
      extractJsonMiddleware({
        transform: (text) => {
          const start = text.indexOf("{");
          const end = text.lastIndexOf("}");
          if (start !== -1 && end > start) return text.slice(start, end + 1);
          return text
            .trim()
            .replace(/^```(?:json)?\s*\n?/, "")
            .replace(/\n?```\s*$/, "")
            .trim();
        },
      }),
    );
  }
  return wrapLanguageModel({
    model: provider.chatModel(params.modelId),
    middleware,
  });
}

export function assertSafeProviderUrl(baseUrl: string) {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("Base URL tidak valid");
  }

  const allowLocal = process.env.ALLOW_LOCAL_AI_PROVIDER === "true";
  const host = url.hostname.toLowerCase();
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local");
  const isPrivate =
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    if (!(allowLocal && isLocal)) {
      throw new Error("Di production, base URL harus HTTPS");
    }
  }

  if ((isLocal || isPrivate) && !allowLocal) {
    throw new Error("URL lokal/private tidak diizinkan");
  }

  return url.toString().replace(/\/$/, "");
}

export const GENERATION_SYSTEM_PROMPT = `Kamu adalah pembuat soal olimpiade AI (EKKA / IOAI Indonesia) untuk siswa SMA/SMK.

Aturan silabus (WAJIB):
- Soal HARUS hanya menguji konsep pada track/topic yang diminta.
- Gunakan materi referensi silabus yang diberikan sebagai acuan utama (definisi, rumus, contoh, tingkat kedalaman).
- Jangan membawa konsep di luar topic tersebut kecuali sebagai prasyarat sangat dasar yang sudah disebut di materi.
- Jangan buat soal yang butuh library/API/topik di luar cakupan SMA/SMK olimpiade AI pada modul tersebut.
- Tingkat kesulitan harus sesuai angka difficulty, tetap dalam lingkup materi silabus.

Kualitas soal:
- Buat soal cerita yang menuntut pemahaman konsep, bukan hafalan.
- Jawaban harus deterministik dan bisa dinilai otomatis.
- Tulis stem dan solusi dalam Bahasa Indonesia.
- Untuk numeric, berikan angka eksak atau dengan toleransi yang masuk akal.
- Untuk mcq, sediakan choices dan answer harus SALINAN PERSIS (karakter demi karakter) salah satu string di choices.
- Solusi harus menjelaskan langkah demi langkah secara detail, merujuk konsep dari materi silabus.

PENTING: Balas HANYA dengan satu objek JSON valid, tanpa teks lain, tanpa markdown, tanpa penjelasan.
JSON harus sesuai skema berikut:
${JSON.stringify(z.toJSONSchema(generatedProblemSchema))}`;

export const REVIEW_SYSTEM_PROMPT = `Kamu adalah tutor AI untuk siswa yang sedang mereview soal EKKA/OSN AI.
Jawab dalam Bahasa Indonesia yang jelas dan pedagogis.
Gunakan konteks soal, jawaban siswa, dan solusi resmi.
Jangan memberikan jawaban untuk soal lain di luar konteks.
Dorong pemahaman: jelaskan mengapa, bukan hanya apa.`;

export const STUDY_ASSISTANT_SYSTEM_PROMPT = `Kamu adalah asisten belajar untuk siswa SMA/SMK yang sedang mempelajari modul silabus EKKA / OSN AI.
Jawab dalam Bahasa Indonesia yang jelas, ringkas, dan pedagogis.
Bantu siswa memahami materi modul: jelaskan konsep, beri analogi, contoh, dan langkah berpikir.
Utamakan materi/konteks modul yang diberikan. Jika siswa bertanya di luar topik, arahkan kembali ke silabus.
Dorong pemahaman: jelaskan mengapa, bukan hanya hafalan.
Jangan membuat soal ujian lengkap kecuali diminta sebagai latihan singkat.
Jangan mengarang fakta; jika tidak yakin, katakan demikian.`;

export const ADMIN_ASSISTANT_SYSTEM_PROMPT = `Kamu adalah asisten analitik untuk admin platform Simulasi OSN AI / EKKA.
Jawab dalam Bahasa Indonesia yang jelas, ringkas, dan berbasis data.
Gunakan HANYA snapshot aktivitas platform yang diberikan di konteks. Jika data tidak cukup, katakan demikian — jangan mengarang angka.
Bantu admin memahami perilaku siswa: aktivitas, akurasi, topik lemah, mock, siapa perlu perhatian, tren singkat.
Berikan insight yang actionable (misalnya siswa mana yang perlu di-follow-up, topik yang perlu dikuatkan).
Jangan membocorkan password atau API key. Email siswa boleh disebut karena ini konteks admin.
Jika ditanya hal di luar data platform, jawab singkat lalu arahkan kembali ke analisis platform.`;
