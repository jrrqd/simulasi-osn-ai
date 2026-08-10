/**
 * PREDIKSI / EKKA study-case style guidance + few-shot exemplars
 * (anonymized from curated p-osn26 bank — not for copying numbers).
 */

import { EXAM_PYTHON_POLICY } from "@/lib/ai/exam-python-policy";

export const PREDIKSI_FIGURE_RULES = `Gambar / diagram (opsional):
- Ada DUA jalur visual — pilih satu yang cocok, jangan keduanya untuk id yang sama:
  1) "figures": diagram SVG terstruktur { "id", "alt?", "diagram" } untuk plot/data/pohon/grafik.
  2) "imagePrompts": gambar raster AI { "id", "alt", "prompt" } untuk geometri / ilustrasi bebas.
- Di stem/preamble, sisipkan placeholder {{fig:ID}} persis di tempat gambar harus muncul.
- Maksimal 4 imagePrompts per soal. prompt ≤ 1500 karakter, bahasa Inggris, gaya "clean exam diagram, labeled, white background, no decorative fluff".
- Pakai imagePrompts HANYA jika soal butuh ilustrasi geometri (segitiga berlabel, lingkaran, bangun 3D, konstruksi koordinat, vektor sebagai panah berlabel) yang TIDAK bisa digambar sebagai scatter/grid/tree/kernel/bars/table/graph.
- Jangan pakai imagePrompts untuk scatter plot, heatmap, decision tree, kernel matrix, bar chart, tabel, atau graf — itu wajib lewat "figures".
- diagram.kind HARUS salah satu: scatter | grid | tree | kernel | bars | table | graph.
- scatter: { kind:"scatter", points:[{x,y,group?,label?}], lines?, xLabel?, yLabel?, title? }
- grid: { kind:"grid", cells:[[0/1 atau angka]], palette:"bw"|"heatmap", showValues?, title? }
- tree: { kind:"tree", nodes:[{id,label,leaf?}], edges:[{from,to,label?}], title? }
- kernel: { kind:"kernel", matrix:[[angka]], title? }
- bars: { kind:"bars", bars:[{label,value}], yLabel?, title? }
- table: { kind:"table", headers:[...], rows:[[...]], title? }
- graph: { kind:"graph", nodes:[{id,label?}], edges:[{from,to,label?}], directed?, title? }
- JANGAN menulis ![markdown](...) sendiri; jangan mengarang URL gambar.
- Jika soal butuh plot/citra/kernel/pohon, WAJIB isi figures + placeholder.
- Jika soal butuh gambar geometri, isi imagePrompts + placeholder (model memutuskan sendiri).
- Jika soal murni hitungan teks, figures dan imagePrompts boleh kosong/dihilangkan.`;

export const PREDIKSI_STYLE_RULES = `Gaya soal PREDIKSI / studi kasus EKKA (WAJIB diikuti):
- Buat soal CERITA konkret (skenario dunia nyata: prediksi cuaca, kurir, kolam, metrik model, attention, embedding, dll).
- Prefer hitung-lalu-pilih: dataset kecil + aritmetika eksak (peluang, regresi/Huber, GD satu langkah, metrik).
- Untuk MCQ pecahan, tulis pilihan sebagai string plain seperti "1/3", "3/10", "0,535".
- Untuk multi-pilih huruf (fitur), gunakan answerType short_string dengan jawaban seperti "a,c" atau "b,c".
- Boleh menulis rumus dengan KaTeX inline $...$ atau $$...$$ (mis. $P(H)=1/2$, $\\dfrac{2}{5}$).
- Solusi 3–8 kalimat, merujuk angka di soal; jangan spoiler pilihan yang tidak relevan.
- Soal text-only tetap OK jika tidak butuh visual.
- JANGAN menyalin contoh few-shot; ganti angka, nama, dan skenario.

### Format jawaban numeric (OSN AI 2026 — WAJIB untuk answerType=numeric)
Pilih salah satu dan tulis di field "numericFormat":
- "integer" — bilangan bulat, contoh jawaban: "25" (BUKAN "25.0")
- "decimal" — angka dengan/tanpa titik desimal, contoh: "0.5"
- "space_separated" — beberapa angka dipisah spasi tunggal, contoh: "1 2 3"
- "comma_separated" — beberapa angka dipisah koma tanpa spasi, contoh: "1,2,3"
Sebutkan format yang diminta juga di deskripsi soal (stem).

### Format soal coding Python (answerType=codeSpec)
- WAJIB isi "codeSpec.skeleton" dengan marker "# >>> WRITE HERE <<<" … "# <<< END <<<"
- WAJIB isi "codeSpec.testCases" ≥ 3 (normal + edge case)
- WAJIB isi "codeSpec.timeLimitMs" (500–10000) dan "codeSpec.memoryLimitMb" (64–1024)
- Kode DI LUAR marker tidak boleh diubah peserta
- weight coding = 2 (numeric/mcq/short_string = 1)

### Konteks matematika non-SMA
Jika soal memakai konsep di luar SMA (eigenvalue, softmax, attention, IoU, mAP, gradient norm, cross-entropy):
- Tulis 1–3 kalimat definisi/rumus di awal stem.
- Jangan andalkan prasyarat SMA.

${PREDIKSI_FIGURE_RULES}

${EXAM_PYTHON_POLICY}`;

/** Compact few-shots for single-problem generation (structure + tone only). */
export const PREDIKSI_FEW_SHOT_SINGLE = `Contoh gaya (JANGAN disalin angka/skenario; buat soal BARU):

Contoh A (numeric, probabilitas):
{"title":"Ekspektasi kejadian","track":"A","topic":"probabilitas","difficulty":2,"answerType":"numeric","numericFormat":"integer","weight":1,"stem":"**Studi kasus: Prediksi cuaca**\\n\\nPeluang hujan $P(H)=2/5$. Asumsikan hari i.i.d.\\n\\nSelama 50 hari, berapa ekspektasi jumlah hari hujan? (jawaban bilangan bulat)","answer":20,"tolerance":0,"solution":"E = 50 · (2/5) = 20.","tags":["prediksi-style"]}

Contoh B (mcq, supervised):
{"title":"Prediksi model awal","track":"B","topic":"supervised-learning","difficulty":2,"answerType":"mcq","stem":"**Studi kasus: Kurir**\\n\\nModel: prediksi = 0,2·jarak + 0,5·berat + 0,4.\\n\\nPrediksi untuk jarak 4 dan berat 6?","choices":["3,2","4,0","4,2","5,1"],"answer":"4,2","solution":"0,2·4 + 0,5·6 + 0,4 = 0,8 + 3,0 + 0,4 = 4,2.","tags":["prediksi-style"]}

Contoh C (short_string, feature):
{"title":"Fitur yang cukup","track":"B","topic":"feature-engineering","difficulty":3,"answerType":"short_string","stem":"**Studi kasus: Model alternatif**\\n\\nIngin merepresentasikan keputusan linear pada x1,x2,y1,y2 dengan binary logistic.\\n\\na. [x1,x2]\\nb. [x1,x2,y1,y2]\\nc. [x1·y1,x2·y2]\\n\\nTulis semua huruf yang memungkinkan, dipisah koma (contoh: a,b).","answer":"b","solution":"Keputusan butuh semua komponen; hanya opsi b menyediakan fitur lengkap.","tags":["prediksi-style"]}`;

export const STUDY_CASE_SYSTEM_PROMPT = `Kamu adalah pembuat STUDI KASUS olimpiade AI bergaya PREDIKSI / EKKA untuk SMA/SMK.

${PREDIKSI_STYLE_RULES}

Struktur keluaran: SATU objek JSON studi kasus (bukan JSON Schema):
{
  "caseTitle": "judul kasus singkat",
  "preamble": "konteks bersama (markdown/KaTeX OK), tanpa pertanyaan",
  "track": "A|B|C|D",
  "topic": "slug-topic",
  "difficulty": 1-5,
  "figures": [
    { "id": "fig1", "alt": "opsional", "diagram": { "kind": "scatter", "points": [{"x":0,"y":1,"group":"A"}] } }
  ],
  "problems": [
    {
      "title": "judul soal singkat",
      "answerType": "numeric|mcq|short_string|python_output|codeSpec",
      "prompt": "teks pertanyaan saja (preamble sudah diberikan terpisah)",
      "answer": "nilai atau string",
      "tolerance": 0.001,
      "numericFormat": "integer|decimal|space_separated|comma_separated (wajib jika numeric)",
      "choices": ["opsional untuk mcq"],
      "starterCode": "wajib jika python_output — program lengkap untuk runner in-exam",
      "codeSpec": "wajib jika codeSpec — skeleton+testCases+limits",
      "weight": 1,
      "solution": "3-8 kalimat"
    }
  ]
}

Aturan studi kasus:
- Buat 3 sampai 5 soal yang BERKAITAN pada preamble yang sama (hitungan bertahap diperbolehkan).
- Jika ada blok "Referensi IOAI", pakai hanya sebagai inspirasi gaya/kedalaman — jangan salin soal/dataset asli.
- Setiap prompt harus berdiri sendiri jika digabung: stem akhir = preamble + prompt.
- Semua soal harus auto-gradable dan konsisten dengan angka di preamble.
- Jika ada blok "Referensi kompetisi IOAI", gunakan HANYA sebagai inspirasi format/kedalaman — JANGAN menyalin soal atau dataset.
- figures (jika ada) dipakai bersama di preamble via {{fig:id}}; jangan duplikasi di setiap prompt.
- Text-only OK jika kasus tidak butuh visual.
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

  return `Buat SATU studi kasus baru bergaya PREDIKSI dengan ${params.problemCount} soal terkait.

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
