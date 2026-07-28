/**
 * Timed-mock policy for Python / code-output questions.
 * Students have an in-exam Pyodide runner — they must not leave the tab.
 */

export const EXAM_PYTHON_POLICY = `Kebijakan soal Python di simulasi berwaktu (WAJIB):
- Platform menyediakan runner Python IN-EXAM (Pyodide). Siswa TIDAK boleh diminta pindah tab, buka IDE eksternal, atau alat di luar halaman ujian.
- Jika answerType = "python_output": WAJIB sertakan "starterCode" berisi program lengkap yang dijalankan di runner (sumber kebenaran kode).
- Stem boleh menampilkan cuplikan kode (fence \`\`\`python), tetapi starterCode harus ada dan konsisten dengan stem.
- Jawaban = output program (stdout) yang deterministik; jangan soal yang butuh input interaktif, file lokal, jaringan, atau package di luar stdlib Pyodide.
- JANGAN menulis instruksi seperti "buka IDE", "jalankan di komputer", "copy ke Colab", atau "pindah tab".
- Soal "baca kode / prediksi output" yang dinilai numeric/short_string tanpa runner: buat cukup pendek untuk ditelusuri mental; jika butuh eksekusi, pakai python_output + starterCode.`;

/** True when the exam UI should show the in-tab Python runner. */
export function needsExamPythonRunner(problem: {
  answerType?: string | null;
  starterCode?: string | null;
}): boolean {
  return (
    problem.answerType === "python_output" ||
    Boolean(problem.starterCode?.trim())
  );
}

/** Pull a ```python ... ``` block from stem when starterCode is missing. */
export function extractPythonStarterFromStem(stem: string): string | undefined {
  const match = stem.match(/```(?:python)?\s*\n([\s\S]*?)```/i);
  const code = match?.[1]?.trim();
  return code || undefined;
}
