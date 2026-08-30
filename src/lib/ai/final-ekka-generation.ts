import type { AiMockAnswerType } from "@/lib/ai/ai-mock-plan";
import type { FinalEkkaGenerationProfile } from "@/lib/ai/final-ekka-presets";

/**
 * Retry rotation for a mock slot.
 * Preserves the slot's answer-type family so Final Day 2 programming
 * slots never fall back to numeric/mcq on retry.
 */
export function slotAnswerTypeRotation(
  slotAnswerType: AiMockAnswerType,
  longFormCoding: boolean,
): AiMockAnswerType[] {
  if (longFormCoding || slotAnswerType === "notebook_submission") {
    return [
      "notebook_submission",
      "notebook_submission",
      "notebook_submission",
    ];
  }
  if (slotAnswerType === "codeSpec") {
    return ["codeSpec", "codeSpec", "codeSpec"];
  }
  if (slotAnswerType === "python_output") {
    return ["python_output", "numeric", "short_string"];
  }
  return [
    slotAnswerType,
    "numeric",
    "mcq",
    "short_string",
    "codeSpec",
  ];
}

/** True when this slot should use long-form notebook generation budget. */
export function slotNeedsLongFormCoding(
  answerType: AiMockAnswerType | string,
): boolean {
  return answerType === "notebook_submission";
}

/** Prompt policy block for Final EKKA day profiles. */
export function buildFinalEkkaPromptBlock(params: {
  profile: FinalEkkaGenerationProfile;
  answerType: string;
}): string {
  if (params.profile === "final-day-1") {
    return `
## Profil Final EKKA 2026 — Hari 1 (Tes Problem Solving AI)
- Durasi resmi booklet: 5 jam (08.00–13.00 WIB, 16 September 2026).
- Buat soal REASONING/HITUNG/INTERPRETASI model yang dalam (multi-langkah), bukan trivia.
- Prefer evaluasi model, metrik, backprop/gradien sederhana, feature effect, atau keputusan desain ML.
- Jawaban singkat & format ketat (numericFormat bila numeric). Jangan minta notebook/CSV.
- answerType harus "${params.answerType}".
- Tag "final-ekka-2026" dan "final-day-1".
`;
  }

  if (params.answerType === "notebook_submission") {
    return `
## Profil Final EKKA 2026 — Hari 2 (Tes Programming) · kompetisi notebook
- Durasi resmi booklet: 5 jam (08.00–13.00 WIB, 17 September 2026).
- Satu challenge notebook + CSV sintetis kecil (train/test/sample_submission).
- Baseline harus reproducible di Pyodide (pandas); jangan butuh GPU/model besar.
- Sertakan metrik jelas; siswa Submit CSV di platform.
- Tag "final-ekka-2026", "final-day-2", "kaggle-style".
`;
  }

  return `
## Profil Final EKKA 2026 — Hari 2 (Tes Programming) · coding codeSpec
- Durasi resmi booklet: 5 jam (08.00–13.00 WIB, 17 September 2026).
- Implementasi algoritma AI/ML terkait topic (preprocessing, metrik, fitur, model sederhana).
- WAJIB codeSpec dengan marker WRITE HERE + ≥3 testCases (termasuk edge).
- Dikerjakan di runner in-exam; jangan minta IDE eksternal.
- Tag "final-ekka-2026" dan "final-day-2".
`;
}
