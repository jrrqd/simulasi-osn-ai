/**
 * Timed-mock policy for Python / code-output questions.
 * Students have an in-exam Pyodide runner — they must not leave the tab.
 */

import {
  DEFAULT_WRITE_CLOSE,
  DEFAULT_WRITE_OPEN,
  skeletonHasMarkers,
} from "@/lib/ai/code-skeleton";

export const EXAM_PYTHON_POLICY = `Kebijakan soal Python di simulasi berwaktu (WAJIB):
- Platform menyediakan runner Python IN-EXAM (Pyodide). Siswa TIDAK boleh diminta pindah tab, buka IDE eksternal, atau alat di luar halaman ujian.
- Jika answerType = "python_output" (legacy): WAJIB sertakan "starterCode" berisi program lengkap; jawaban = stdout deterministik.
- Jika answerType = "codeSpec" (OSN AI 2026): WAJIB isi "codeSpec" dengan:
  - skeleton: program lengkap berisi marker "${DEFAULT_WRITE_OPEN}" … "${DEFAULT_WRITE_CLOSE}"
  - testCases: minimal 3 (normal + edge case), tiap case {input, expectedOutput, weight?}
  - timeLimitMs: 500–10000 (contoh 2000)
  - memoryLimitMb: 64–1024 (contoh 256)
- Kode DI LUAR marker WRITE HERE / END tidak boleh diubah peserta; hanya zona di antara marker yang boleh diisi.
- Stem boleh menampilkan cuplikan kode (fence \`\`\`python), tetapi skeleton/starterCode harus ada dan konsisten dengan stem.
- Jangan soal yang butuh input interaktif, file lokal, jaringan, atau package di luar stdlib Pyodide.
- JANGAN menulis instruksi seperti "buka IDE", "jalankan di komputer", "copy ke Colab", atau "pindah tab".
- Bobot coding = 2 (isian numerik = 1) sesuai format OSN AI 2026.`;

/** True when the exam UI should show the in-tab Python runner. */
export function needsExamPythonRunner(problem: {
  answerType?: string | null;
  starterCode?: string | null;
  codeSpec?: unknown;
}): boolean {
  return (
    problem.answerType === "python_output" ||
    problem.answerType === "codeSpec" ||
    Boolean(problem.starterCode?.trim()) ||
    Boolean(problem.codeSpec)
  );
}

export function needsCodeSpecRunner(problem: {
  answerType?: string | null;
  codeSpec?: unknown;
}): boolean {
  return problem.answerType === "codeSpec" || Boolean(problem.codeSpec);
}

/** Pull a ```python ... ``` block from stem when starterCode is missing. */
export function extractPythonStarterFromStem(stem: string): string | undefined {
  const match = stem.match(/```(?:python)?\s*\n([\s\S]*?)```/i);
  const code = match?.[1]?.trim();
  return code || undefined;
}

export function codeSpecSkeletonValid(skeleton: string): boolean {
  return skeletonHasMarkers(skeleton);
}
