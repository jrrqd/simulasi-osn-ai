import { generateText, Output } from "ai";
import { z } from "zod";
import { createUserProvider } from "@/lib/ai/provider";
import {
  labelDifficultyMode,
  type DifficultyMode,
} from "@/lib/ai/difficulty";
import {
  CURATED_MOCK_SIZES,
  type CuratedMockSize,
} from "@/lib/ai/curated-mock-size";
import { matchTopicsFromPrompt } from "@/lib/ai/topic-prompt";
import { buildNaturalMockTitle } from "@/lib/ai/mock-title";
import { buildIoaiKnowledgeContext } from "@/lib/ai/ioai-prompt-context";
import { listIoaiResourcesForPrompt } from "@/lib/content/ioai-resources";
import { getProblems } from "@/lib/content/load";
import type { Problem, TrackId } from "@/lib/content/types";
import { TOPIC_LABELS } from "@/lib/content/types";
import { canAccessIoaiResources } from "@/lib/user/load-phase";
import type { Phase } from "@/lib/user/phase";

export type { CuratedMockSize } from "@/lib/ai/curated-mock-size";
export { CURATED_MOCK_SIZES } from "@/lib/ai/curated-mock-size";
export {
  matchTopicsFromPrompt,
  normalizeTopicPrompt,
  TOPIC_PROMPT_MAX_LEN,
  TOPIC_PROMPT_MIN_LEN,
} from "@/lib/ai/topic-prompt";

const assemblySchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(400),
  problemIds: z.array(z.string()).min(1),
});

function catalogLine(p: Problem) {
  return `${p.id} | track=${p.track} | topic=${p.topic} (${TOPIC_LABELS[p.topic] ?? p.topic}) | D${p.difficulty} | ${p.answerType} | ${p.title}`;
}

function scoreForMode(p: Problem, mode: DifficultyMode) {
  if (mode === "easy") return p.difficulty === 1 ? 3 : p.difficulty === 2 ? 1 : 0;
  if (mode === "hard") return p.difficulty >= 3 ? 3 : p.difficulty === 2 ? 1 : 0;
  if (mode === "medium") return p.difficulty === 2 ? 3 : p.difficulty === 1 || p.difficulty === 3 ? 1 : 0;
  if (mode === "semifinal") {
    if (p.difficulty >= 4) return 3;
    if (p.difficulty === 3) return 1;
    return 0;
  }
  // normal: prefer middle, still allow mix
  return p.difficulty === 2 ? 2 : 1;
}

function topicPreferenceScore(p: Problem, preferredTopics: string[]) {
  if (preferredTopics.length === 0) return 0;
  return preferredTopics.includes(p.topic) ? 10 : 0;
}

/** Deterministic fallback if LLM output is incomplete/invalid. */
export function assembleCuratedFallback(
  count: number,
  mode: DifficultyMode,
  trackFilter?: TrackId,
  preferredTopics: string[] = [],
): string[] {
  let pool = getProblems();
  if (trackFilter) pool = pool.filter((p) => p.track === trackFilter);
  const ranked = [...pool].sort((a, b) => {
    const ts =
      topicPreferenceScore(b, preferredTopics) -
      topicPreferenceScore(a, preferredTopics);
    if (ts !== 0) return ts;
    const ds = scoreForMode(b, mode) - scoreForMode(a, mode);
    if (ds !== 0) return ds;
    return a.id.localeCompare(b.id);
  });

  const picked: Problem[] = [];
  const used = new Set<string>();

  // Prefer requested topics first when present
  if (preferredTopics.length > 0) {
    for (const p of ranked) {
      if (picked.length >= count) break;
      if (preferredTopics.includes(p.topic) && !used.has(p.id)) {
        picked.push(p);
        used.add(p.id);
      }
    }
  }

  const tracks: TrackId[] = trackFilter
    ? [trackFilter]
    : (["A", "B", "C", "D"] as TrackId[]);

  // Round-robin across tracks from ranked list for balance
  while (picked.length < count && used.size < ranked.length) {
    let added = false;
    for (const t of tracks) {
      if (picked.length >= count) break;
      const next = ranked.find((p) => p.track === t && !used.has(p.id));
      if (next) {
        picked.push(next);
        used.add(next.id);
        added = true;
      }
    }
    if (!added) break;
  }

  // Fill remaining from ranked
  for (const p of ranked) {
    if (picked.length >= count) break;
    if (!used.has(p.id)) {
      picked.push(p);
      used.add(p.id);
    }
  }

  return picked.slice(0, count).map((p) => p.id);
}

function sanitizeProblemIds(
  ids: string[],
  count: number,
  mode: DifficultyMode,
  trackFilter?: TrackId,
  preferredTopics: string[] = [],
) {
  const valid = new Set(getProblems().map((p) => p.id));
  const allowedTrack = trackFilter;
  const unique: string[] = [];
  for (const id of ids) {
    if (!valid.has(id)) continue;
    if (allowedTrack) {
      const p = getProblems().find((x) => x.id === id);
      if (!p || p.track !== allowedTrack) continue;
    }
    if (!unique.includes(id)) unique.push(id);
    if (unique.length >= count) break;
  }
  if (unique.length < count) {
    const fill = assembleCuratedFallback(
      count,
      mode,
      trackFilter,
      preferredTopics,
    ).filter((id) => !unique.includes(id));
    unique.push(...fill);
  }
  return unique.slice(0, count);
}

export async function assembleCuratedMockWithLlm(params: {
  difficultyMode: DifficultyMode;
  size: CuratedMockSize;
  trackFilter?: TrackId;
  topicPrompt?: string;
  /** Competition phase — gates IOAI knowledge injection. */
  phase?: Phase;
  role?: string | null;
  baseUrl: string;
  apiKey: string;
  modelId: string;
}) {
  const sizeMeta =
    CURATED_MOCK_SIZES.find((s) => s.value === params.size) ??
    CURATED_MOCK_SIZES[0]!;
  const count = sizeMeta.count;
  const durationMinutes = sizeMeta.durationMinutes;
  const topicPrompt = params.topicPrompt?.trim() || undefined;
  const preferredFromPrompt = topicPrompt
    ? matchTopicsFromPrompt(topicPrompt)
    : [];

  const phase = params.phase ?? "pre-seleksi";
  const role = params.role ?? null;
  let ioaiTopics: string[] = [];
  let ioaiBlock = "";
  if (canAccessIoaiResources(phase, role)) {
    const ioaiResources = await listIoaiResourcesForPrompt({
      topics: preferredFromPrompt,
      focusPrompt: topicPrompt,
      limit: 5,
    });
    ioaiTopics = [...new Set(ioaiResources.flatMap((r) => r.topics))].slice(
      0,
      8,
    );
    ioaiBlock = await buildIoaiKnowledgeContext({
      phase,
      role,
      topics: preferredFromPrompt.length > 0 ? preferredFromPrompt : ioaiTopics,
      focusPrompt: topicPrompt,
      limit: 4,
      includeGuideRingkasan: false,
    });
  }

  const preferredTopics = [
    ...new Set([...preferredFromPrompt, ...ioaiTopics]),
  ];

  let pool = getProblems();
  if (params.trackFilter) {
    pool = pool.filter((p) => p.track === params.trackFilter);
  }
  if (pool.length < count) {
    throw new Error(
      `Bank curated tidak cukup (${pool.length} soal, butuh ${count}).`,
    );
  }

  const catalog = pool.map(catalogLine).join("\n");
  const modeLabel = labelDifficultyMode(params.difficultyMode);
  const trackScope = params.trackFilter
    ? `Hanya track ${params.trackFilter}`
    : "Lintas track A–D (seimbang)";
  const topicCatalogHint = Object.entries(TOPIC_LABELS)
    .map(([id, label]) => `${id} (${label})`)
    .join(", ");

  const model = createUserProvider({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    modelId: params.modelId,
    jsonOutput: true,
    disableThinking: true,
  });

  const topicBlock = topicPrompt
    ? `
Preferensi topik dari siswa (WAJIB diutamakan):
"""
${topicPrompt}
"""
Topik resmi di bank (untuk mapping): ${topicCatalogHint}
${
  preferredTopics.length > 0
    ? `Topik yang terdeteksi dari preferensi + IOAI: ${preferredTopics.join(", ")}.`
    : "Tidak ada id topik yang terdeteksi pasti — interpretasikan preferensi siswa secara semantik."
}

Aturan preferensi topik:
- Utamakan soal yang relevan dengan preferensi di atas (target ≥60% dari paket bila bank topik itu cukup).
- Jika bank topik yang diminta terlalu tipis untuk mengisi ${count} soal, lengkapi sisa dari topik terdekat / track terkait.
- Jangan mengabaikan preferensi hanya demi keseimbangan track.
- Di description, sebutkan singkat fokus topik yang dipilih.
`
    : ioaiTopics.length > 0
      ? `
Aturan cakupan (fase IOAI aktif):
- Utamakan topik IOAI-adjacent bila tersedia di bank: ${ioaiTopics.join(", ")}.
- Target ≥40% paket dari topik tersebut jika bank cukup; sisanya seimbangkan track.
- Sebar track agar tidak menumpuk di satu area (kecuali filter track aktif).
`
      : `
Aturan cakupan:
- Sebar topik/track agar tidak menumpuk di satu area (kecuali filter track aktif).
`;

  const prompt = `Susun SATU paket simulasi olimpiade AI dari bank soal curated berikut.

Target:
- Jumlah soal: tepat ${count}
- Durasi: ${durationMinutes} menit
- Tingkat kesulitan target: ${modeLabel} (${params.difficultyMode})
- Cakupan: ${trackScope}
${topicBlock}
${ioaiBlock ? `${ioaiBlock}\n` : ""}
Aturan umum:
- Pilih HANYA id dari katalog. Jangan invent id baru.
- Tidak boleh duplikat.
- Urutkan dari lebih mudah ke lebih sulit secara bertahap jika memungkinkan.
- Untuk mode easy: utamakan D1, sedikit D2.
- Untuk mode medium: utamakan D2.
- Untuk mode hard: utamakan D3 (dan D2 jika perlu).
- Untuk mode normal: campuran seimbang mendekati distribusi normal (lebih banyak D2).
${
  ioaiBlock
    ? `- Jika referensi IOAI ada: pilih soal curated yang paling dekat gaya/topik tersebut (bukan menyalin statement IOAI).`
    : ""
}

Judul (title):
- Buat judul pendek & natural dalam Bahasa Indonesia, mudah dikenali (contoh: "Tryout Backprop & Regularisasi", "Paket curated ML Klasik").
- JANGAN pakai awalan "Simulasi curated ·" atau "Simulasi AI ·".
- JANGAN sebut jumlah soal atau durasi di title (itu sudah di meta paket).
- Maksimal ~60 karakter.

Katalog (id | meta | judul):
${catalog}

Balas JSON dengan field: title, description, problemIds (array string sepanjang ${count}).`;

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: assemblySchema }),
      system:
        "Kamu adalah penyusun ujian EKKA/OSN AI. Pilih dan urutkan soal curated sesuai preferensi topik bila ada. Beri judul natural yang mudah diingat. Balas hanya JSON valid sesuai skema.",
      prompt,
      abortSignal: AbortSignal.timeout(120_000),
    });
    const parsed = assemblySchema.parse(result.output);
    const problemIds = sanitizeProblemIds(
      parsed.problemIds,
      count,
      params.difficultyMode,
      params.trackFilter,
      preferredTopics,
    );
    const naturalFallback = buildNaturalMockTitle({
      kind: "curated_assembled",
      generationMode: topicPrompt ? "custom" : "standard",
      track: params.trackFilter ?? "ALL",
      difficultyMode: params.difficultyMode,
      count,
      topicLabels:
        preferredTopics.length > 0
          ? preferredTopics.slice(0, 3).map((t) => TOPIC_LABELS[t] ?? t)
          : undefined,
      topicPrompt,
    });
    const llmTitle = parsed.title.trim();
    const title =
      /^(Simulasi AI|Simulasi curated)\s*·/i.test(llmTitle) ||
      /\d+\s*soal|\d+\s*menit/i.test(llmTitle)
        ? naturalFallback
        : llmTitle.slice(0, 60);
    return {
      title,
      description: parsed.description,
      problemIds,
      durationMinutes,
      count,
      usedFallback: problemIds.length < count,
      preferredTopics,
    };
  } catch {
    const problemIds = assembleCuratedFallback(
      count,
      params.difficultyMode,
      params.trackFilter,
      preferredTopics,
    );
    const topicSuffix =
      preferredTopics.length > 0
        ? ` · Fokus: ${preferredTopics
            .slice(0, 3)
            .map((t) => TOPIC_LABELS[t] ?? t)
            .join(", ")}`
        : topicPrompt
          ? " · Fokus topik kustom"
          : "";
    return {
      title: buildNaturalMockTitle({
        kind: "curated_assembled",
        generationMode: topicPrompt ? "custom" : "standard",
        track: params.trackFilter ?? "ALL",
        difficultyMode: params.difficultyMode,
        count,
        topicLabels:
          preferredTopics.length > 0
            ? preferredTopics
                .slice(0, 3)
                .map((t) => TOPIC_LABELS[t] ?? t)
            : undefined,
        topicPrompt,
      }),
      description: topicPrompt
        ? `Paket ${count} soal curated (${durationMinutes} menit) disusun otomatis mengikuti preferensi: ${topicPrompt.slice(0, 160)}${topicSuffix}`
        : `Paket ${count} soal dari bank curated (disusun otomatis, ${durationMinutes} menit). Siap dikerjakan semua siswa.`,
      problemIds,
      durationMinutes,
      count,
      usedFallback: true,
      preferredTopics,
    };
  }
}
