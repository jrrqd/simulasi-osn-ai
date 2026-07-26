/**
 * hAIplay / EKKA study-case style guidance + few-shot exemplars
 * (anonymized from curated p-osn26 bank — not for copying numbers).
 */

export const HAIPLAY_STYLE_RULES = `Gaya soal hAIplay / studi kasus EKKA (WAJIB diikuti):
- Buat soal CERITA konkret (skenario dunia nyata: prediksi cuaca, kurir, kolam, metrik model, attention, embedding, dll).
- Prefer hitung-lalu-pilih: dataset kecil + aritmetika eksak (peluang, regresi/Huber, GD satu langkah, metrik).
- Untuk MCQ pecahan, tulis pilihan sebagai string plain seperti "1/3", "3/10", "0,535".
- Untuk multi-pilih huruf (fitur), gunakan answerType short_string dengan jawaban seperti "a,c" atau "b,c".
- Boleh menulis rumus dengan KaTeX inline $...$ atau $$...$$ (mis. $P(H)=1/2$, $\\dfrac{2}{5}$).
- Solusi 3–8 kalimat, merujuk angka di soal; jangan spoiler pilihan yang tidak relevan.
- JANGAN butuh gambar/plot/citra; soal harus text-only.
- JANGAN menyalin contoh few-shot; ganti angka, nama, dan skenario.`;

/** Compact few-shots for single-problem generation (structure + tone only). */
export const HAIPLAY_FEW_SHOT_SINGLE = `Contoh gaya (JANGAN disalin angka/skenario; buat soal BARU):

Contoh A (numeric, probabilitas):
{"title":"Ekspektasi kejadian","track":"A","topic":"probabilitas","difficulty":2,"answerType":"numeric","stem":"**Studi kasus: Prediksi cuaca**\\n\\nPeluang hujan $P(H)=2/5$. Asumsikan hari i.i.d.\\n\\nSelama 50 hari, berapa ekspektasi jumlah hari hujan?","answer":20,"tolerance":0,"solution":"E = 50 · (2/5) = 20.","tags":["haiplay-style"]}

Contoh B (mcq, supervised):
{"title":"Prediksi model awal","track":"B","topic":"supervised-learning","difficulty":2,"answerType":"mcq","stem":"**Studi kasus: Kurir**\\n\\nModel: prediksi = 0,2·jarak + 0,5·berat + 0,4.\\n\\nPrediksi untuk jarak 4 dan berat 6?","choices":["3,2","4,0","4,2","5,1"],"answer":"4,2","solution":"0,2·4 + 0,5·6 + 0,4 = 0,8 + 3,0 + 0,4 = 4,2.","tags":["haiplay-style"]}

Contoh C (short_string, feature):
{"title":"Fitur yang cukup","track":"B","topic":"feature-engineering","difficulty":3,"answerType":"short_string","stem":"**Studi kasus: Model alternatif**\\n\\nIngin merepresentasikan keputusan linear pada x1,x2,y1,y2 dengan binary logistic.\\n\\na. [x1,x2]\\nb. [x1,x2,y1,y2]\\nc. [x1·y1,x2·y2]\\n\\nTulis semua huruf yang memungkinkan, dipisah koma (contoh: a,b).","answer":"b","solution":"Keputusan butuh semua komponen; hanya opsi b menyediakan fitur lengkap.","tags":["haiplay-style"]}`;

export const STUDY_CASE_SYSTEM_PROMPT = `Kamu adalah pembuat STUDI KASUS olimpiade AI bergaya hAIplay / EKKA untuk SMA/SMK.

${HAIPLAY_STYLE_RULES}

Struktur keluaran: SATU objek JSON studi kasus (bukan JSON Schema):
{
  "caseTitle": "judul kasus singkat",
  "preamble": "konteks bersama (markdown/KaTeX OK), tanpa pertanyaan",
  "track": "A|B|C|D",
  "topic": "slug-topic",
  "difficulty": 1-5,
  "problems": [
    {
      "title": "judul soal singkat",
      "answerType": "numeric|mcq|short_string|python_output",
      "prompt": "teks pertanyaan saja (preamble sudah diberikan terpisah)",
      "answer": "nilai atau string",
      "tolerance": 0.001,
      "choices": ["opsional untuk mcq"],
      "solution": "3-8 kalimat"
    }
  ]
}

Aturan studi kasus:
- Buat 3 sampai 5 soal yang BERKAITAN pada preamble yang sama (hitungan bertahap diperbolehkan).
- Setiap prompt harus berdiri sendiri jika digabung: stem akhir = preamble + prompt.
- Semua soal harus auto-gradable dan konsisten dengan angka di preamble.
- Text-only (tanpa gambar).
- Balas HANYA JSON instance, tanpa markdown fence, tanpa komentar.
- Escape newline sebagai \\n di dalam string.

Contoh struktur (JANGAN salin angka/skenario):
{"caseTitle":"Kurir singkat","preamble":"Model: prediksi = 0,3·jarak + 0,2.\\nTitik A: jarak=10.","track":"B","topic":"supervised-learning","difficulty":2,"problems":[{"title":"Prediksi A","answerType":"numeric","prompt":"Berapa prediksi untuk titik A?","answer":3.2,"tolerance":0.001,"solution":"0,3·10 + 0,2 = 3,2."},{"title":"Residual","answerType":"numeric","prompt":"Jika target A=4, residual target−prediksi?","answer":0.8,"tolerance":0.001,"solution":"4 − 3,2 = 0,8."}]}`;

export function buildStudyCaseUserPrompt(params: {
  track: string;
  trackName: string;
  topic: string;
  topicLabel: string;
  difficulty: number;
  problemCount: number;
  syllabus: string;
  focusPrompt?: string;
}) {
  const focus = params.focusPrompt?.trim()
    ? `\nBrief tambahan siswa:\n"""\n${params.focusPrompt.trim()}\n"""\n`
    : "";

  return `Buat SATU studi kasus baru bergaya hAIplay dengan ${params.problemCount} soal terkait.

Track: ${params.track} (${params.trackName})
Topic: ${params.topic} (${params.topicLabel})
Difficulty: ${params.difficulty}
Jumlah soal: ${params.problemCount}

${params.syllabus}
${focus}
Instruksi:
- Preamble berisi data/aturan yang dipakai semua soal.
- Soal boleh bertingkat (soal berikutnya memakai hasil konsep sebelumnya) tetapi tiap jawaban tetap deterministik.
- Field track/topic/difficulty harus sesuai permintaan.
- Jangan menyalin contoh few-shot; buat skenario dan angka baru.
- Balas HANYA satu objek JSON studi kasus.`;
}
