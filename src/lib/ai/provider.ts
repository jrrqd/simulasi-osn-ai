import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  extractJsonMiddleware,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { z } from "zod";
import {
  extractJsonObjectText,
  repairJsonObjectText,
} from "@/lib/ai/parse-json-object";
import {
  HAIPLAY_FEW_SHOT_SINGLE,
  HAIPLAY_STYLE_RULES,
} from "@/lib/ai/haiplay-style";

const answerTypeSchema = z.enum([
  "numeric",
  "short_string",
  "multi_part",
  "python_output",
  "mcq",
]);

export const generatedProblemSchema = z.object({
  title: z.coerce.string().min(3).max(240),
  track: z.enum(["A", "B", "C", "D"]).catch("B"),
  topic: z.coerce.string().min(1).max(64),
  difficulty: z.coerce.number().int().min(1).max(5),
  answerType: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(answerTypeSchema)
    .catch("numeric"),
  stem: z.coerce.string().min(10),
  answer: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number()])),
  ]),
  tolerance: z.coerce.number().optional(),
  choices: z.array(z.union([z.string(), z.number()])).optional(),
  solution: z.coerce.string().min(10),
  tags: z.array(z.coerce.string()).optional(),
  starterCode: z.coerce.string().optional(),
  /** Raw figure specs from the model; materialized after id assignment. */
  figures: z.array(z.unknown()).optional(),
});

export type GeneratedProblemPayload = {
  title: string;
  track: "A" | "B" | "C" | "D";
  topic: string;
  difficulty: number;
  answerType:
    | "numeric"
    | "short_string"
    | "multi_part"
    | "python_output"
    | "mcq";
  stem: string;
  answer: string | number | string[];
  tolerance?: number;
  choices?: string[];
  solution: string;
  tags?: string[];
  starterCode?: string;
  figures?: unknown[];
};

export function normalizeGeneratedProblem(
  raw: z.infer<typeof generatedProblemSchema>,
): GeneratedProblemPayload {
  const answer = raw.answer;
  return {
    ...raw,
    title: raw.title.trim().slice(0, 160),
    answer: Array.isArray(answer)
      ? answer.map(String)
      : typeof answer === "boolean"
        ? answer
          ? "true"
          : "false"
        : answer,
    choices: raw.choices?.map(String),
    figures: raw.figures,
  };
}

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
    // Keep false: MiniMax-M3 (and many OpenAI-compatible hosts) only support
    // response_format=json_object, not json_schema structured outputs.
    supportsStructuredOutputs: false,
    ...(isMiniMax && {
      transformRequestBody: (body: Record<string, unknown>) => {
        // MiniMax-M3 frequently returns unparsable payloads when
        // response_format/json_schema is requested; force plain chat JSON.
        const next: Record<string, unknown> = {
          ...body,
          reasoning_split: true,
        };
        delete next.response_format;
        return next;
      },
    }),
  });
  // Some reasoning models emit <think>...</think> before the answer; strip it
  // so structured output parsing and chat replies stay clean.
  const middleware = [extractReasoningMiddleware({ tagName: "think" })];
  if (params.jsonOutput) {
    // Models often wrap JSON in markdown fences or emit invalid LaTeX escapes;
    // extract + repair before the SDK's JSON.parse.
    middleware.push(
      extractJsonMiddleware({
        transform: (text) => {
          const extracted = extractJsonObjectText(text);
          if (!extracted) return text.trim();
          return repairJsonObjectText(extracted);
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

export const GENERATION_SYSTEM_PROMPT = `Kamu adalah pembuat soal olimpiade AI (EKKA / IOAI Indonesia) untuk siswa SMA/SMK, bergaya studi kasus hAIplay.

Aturan silabus (WAJIB):
- Soal HARUS hanya menguji konsep pada track/topic yang diminta.
- Gunakan materi referensi silabus yang diberikan sebagai acuan utama (definisi, rumus, contoh, tingkat kedalaman).
- Jangan membawa konsep di luar topic tersebut kecuali sebagai prasyarat sangat dasar yang sudah disebut di materi.
- Jangan buat soal yang butuh library/API/topik di luar cakupan SMA/SMK olimpiade AI pada modul tersebut.
- Tingkat kesulitan harus sesuai angka difficulty, tetap dalam lingkup materi silabus.

${HAIPLAY_STYLE_RULES}

Kualitas soal:
- Buat soal cerita yang menuntut pemahaman konsep, bukan hafalan.
- Jawaban harus deterministik dan bisa dinilai otomatis.
- Tulis stem dan solusi dalam Bahasa Indonesia.
- Untuk numeric, berikan angka eksak atau dengan toleransi yang masuk akal.
- Untuk mcq, sediakan choices dan answer harus SALINAN PERSIS (karakter demi karakter) salah satu string di choices.
- Solusi harus menjelaskan langkah demi langkah secara detail, merujuk konsep dari materi silabus.

PENTING: Balas HANYA dengan satu objek JSON SOAL (bukan JSON Schema), tanpa teks lain, tanpa markdown fence, tanpa penjelasan.
- JANGAN mengembalikan skema/schema/$schema/properties/definitions. Kembalikan INSTANCE soal.
- Jika model mendukung thinking, thinking boleh ada, tetapi jawaban akhir WAJIB objek JSON soal di output utama.
- Rumus: boleh KaTeX $...$ / $$...$$ ATAU plain text ("1/2", "x^2", "P(A|B)"). Di JSON, escape backslash ganda untuk perintah LaTeX (\\\\dfrac).
- Di dalam string JSON, hindari tanda kutip ganda; untuk kode/contoh pakai kutip tunggal.
- Escape newline sebagai \\n. Jangan trailing comma. Jangan komentar.
- Solusi cukup 3–8 kalimat; jangan terlalu panjang.
- Tambahkan tag "haiplay-style" jika memakai pola studi kasus.
- Field opsional figures: lihat aturan gambar di atas; gunakan {{fig:id}} di stem.

${HAIPLAY_FEW_SHOT_SINGLE}
`;

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

export const ADMIN_ASSISTANT_SYSTEM_PROMPT = `Kamu adalah asisten admin untuk platform Simulasi OSN AI / EKKA.
Jawab dalam Bahasa Indonesia yang jelas, ringkas, dan berbasis data.
Gunakan snapshot aktivitas platform DAN deskripsi halaman yang sedang dibuka admin.
Jika data tidak cukup, katakan demikian — jangan mengarang angka.
Bantu admin:
- memahami perilaku siswa (aktivitas, akurasi, topik lemah, mock, siapa perlu perhatian);
- memahami konteks halaman saat ini (modul, soal, simulasi, laporan user, pengaturan);
- menavigasi/fitur platform (apa arti halaman ini, langkah berikutnya yang masuk akal).
Untuk soal yang sedang dibuka: admin boleh melihat kunci/solusi; jelaskan dengan jelas.
Jangan membocorkan password atau API key. Email siswa boleh disebut karena ini konteks admin.
Jika ditanya hal di luar data platform, jawab singkat lalu arahkan kembali ke analisis / halaman terkait.`;

export const PERFORMANCE_ASSISTANT_SYSTEM_PROMPT = `Kamu adalah konselor performa untuk siswa SMA/SMK yang sedang menyiapkan seleksi EKKA / OSN AI.
Jawab dalam Bahasa Indonesia yang hangat, jelas, ringkas, dan berbasis data performa siswa di konteks.
Gunakan HANYA data performa yang diberikan. Jika data kurang, katakan demikian — jangan mengarang skor.
Bantu siswa memahami kesiapan OSN AI, skor mock, mastery topik, dan gap prioritas.
Berikan saran actionable: topik mana yang dilatih dulu, apakah perlu mock lagi, cara memperbaiki tren skor.
Dorong motivasi tanpa menekan; fokus pada langkah konkret berikutnya.
Jangan memberikan kunci jawaban soal spesifik; arahkan ke modul belajar / latihan / simulasi di platform.`;

export const PRACTICE_ASSISTANT_SYSTEM_PROMPT = `Kamu adalah asisten latihan (side quest coach) untuk siswa SMA/SMK yang sedang mengerjakan soal di platform Simulasi OSN AI / EKKA.
Jawab dalam Bahasa Indonesia yang jelas, ringkas, dan pedagogis.
Gunakan konteks halaman latihan yang diberikan (daftar soal / filter / soal yang sedang dibuka).
Bantu siswa memahami konsep terkait, memilih strategi, dan menyusun langkah berpikir.
JANGAN memberikan jawaban akhir, kunci numerik, pilihan MCQ yang benar, atau solusi lengkap soal yang sedang dikerjakan.
Berikan petunjuk bertahap (scaffolding): pertanyaan pemandu, konsep yang relevan, kesalahan umum — biarkan siswa menyelesaikan sendiri.
Jika siswa meminta spoiler langsung, tolak dengan lembut dan tawarkan hint berjenjang.
Jika di halaman daftar (bukan soal spesifik), bantu memilih side quest / topik / cara generate tantangan.
Jangan mengarang fakta; jika tidak yakin, katakan demikian.`;

