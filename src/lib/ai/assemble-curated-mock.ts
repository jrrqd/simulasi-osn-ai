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
import { getProblems } from "@/lib/content/load";
import type { Problem, TrackId } from "@/lib/content/types";
import { TOPIC_LABELS } from "@/lib/content/types";

export type { CuratedMockSize } from "@/lib/ai/curated-mock-size";
export { CURATED_MOCK_SIZES } from "@/lib/ai/curated-mock-size";
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
  // normal: prefer middle, still allow mix
  return p.difficulty === 2 ? 2 : 1;
}

/** Deterministic fallback if LLM output is incomplete/invalid. */
export function assembleCuratedFallback(
  count: number,
  mode: DifficultyMode,
  trackFilter?: TrackId,
): string[] {
  let pool = getProblems();
  if (trackFilter) pool = pool.filter((p) => p.track === trackFilter);
  const ranked = [...pool].sort((a, b) => {
    const ds = scoreForMode(b, mode) - scoreForMode(a, mode);
    if (ds !== 0) return ds;
    // spread tracks: A,B,C,D round-robin preference via id
    return a.id.localeCompare(b.id);
  });

  const picked: Problem[] = [];
  const used = new Set<string>();
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
    const fill = assembleCuratedFallback(count, mode, trackFilter).filter(
      (id) => !unique.includes(id),
    );
    unique.push(...fill);
  }
  return unique.slice(0, count);
}

export async function assembleCuratedMockWithLlm(params: {
  difficultyMode: DifficultyMode;
  size: CuratedMockSize;
  trackFilter?: TrackId;
  baseUrl: string;
  apiKey: string;
  modelId: string;
}) {
  const sizeMeta =
    CURATED_MOCK_SIZES.find((s) => s.value === params.size) ??
    CURATED_MOCK_SIZES[0]!;
  const count = sizeMeta.count;
  const durationMinutes = sizeMeta.durationMinutes;

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

  const model = createUserProvider({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    modelId: params.modelId,
    jsonOutput: true,
  });

  const prompt = `Susun SATU paket simulasi olimpiade AI dari bank soal curated berikut.

Target:
- Jumlah soal: tepat ${count}
- Durasi: ${durationMinutes} menit
- Tingkat kesulitan target: ${modeLabel} (${params.difficultyMode})
- Cakupan: ${trackScope}

Aturan:
- Pilih HANYA id dari katalog. Jangan invent id baru.
- Tidak boleh duplikat.
- Urutkan dari lebih mudah ke lebih sulit secara bertahap jika memungkinkan.
- Sebar topik/track agar tidak menumpuk di satu area (kecuali filter track aktif).
- Untuk mode easy: utamakan D1, sedikit D2.
- Untuk mode medium: utamakan D2.
- Untuk mode hard: utamakan D3 (dan D2 jika perlu).
- Untuk mode normal: campuran seimbang mendekati distribusi normal (lebih banyak D2).

Katalog (id | meta | judul):
${catalog}

Balas JSON dengan field: title, description, problemIds (array string sepanjang ${count}).`;

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: assemblySchema }),
      system:
        "Kamu adalah penyusun ujian EKKA/OSN AI. Pilih dan urutkan soal curated. Balas hanya JSON valid sesuai skema.",
      prompt,
      abortSignal: AbortSignal.timeout(120_000),
    });
    const parsed = assemblySchema.parse(result.output);
    const problemIds = sanitizeProblemIds(
      parsed.problemIds,
      count,
      params.difficultyMode,
      params.trackFilter,
    );
    return {
      title: parsed.title,
      description: parsed.description,
      problemIds,
      durationMinutes,
      count,
      usedFallback: problemIds.length < count,
    };
  } catch {
    const problemIds = assembleCuratedFallback(
      count,
      params.difficultyMode,
      params.trackFilter,
    );
    return {
      title: `Simulasi curated · ${modeLabel}${
        params.trackFilter ? ` · Track ${params.trackFilter}` : ""
      }`,
      description: `Paket ${count} soal dari bank curated (disusun otomatis, ${durationMinutes} menit). Siap dikerjakan semua siswa.`,
      problemIds,
      durationMinutes,
      count,
      usedFallback: true,
    };
  }
}
