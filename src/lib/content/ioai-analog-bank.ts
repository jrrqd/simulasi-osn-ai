/**
 * Curated in-platform IOAI year-pack analogs for Latihan Kaggle-style.
 * Synthetic tabular competitions — not copies of official datasets.
 */
import type {
  CompetitionSpec,
  Problem,
  SubmissionScoringMode,
  TrackId,
} from "@/lib/content/types";
import {
  IOAI_YEAR_PACK_IDS,
  practiceProblemIdForResource,
  type IoaiPackYear,
  getIoaiYearPack,
} from "@/lib/content/ioai-year-packs";

/** resourceId → curated practice problem id */
export const IOAI_ANALOG_PROBLEM_BY_RESOURCE: Record<string, string> = {};
for (const year of [2024, 2025, 2026] as const) {
  for (const resourceId of IOAI_YEAR_PACK_IDS[year]) {
    IOAI_ANALOG_PROBLEM_BY_RESOURCE[resourceId] =
      practiceProblemIdForResource(resourceId);
  }
}

export function analogProblemIdForResource(resourceId: string): string | null {
  return IOAI_ANALOG_PROBLEM_BY_RESOURCE[resourceId] ?? null;
}

export function isIoaiAnalogProblemId(id: string): boolean {
  return id.startsWith("p-analog-ioai-");
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type AnalogDef = {
  resourceId: string;
  year: IoaiPackYear;
  shortName: string;
  storyTitle: string;
  overviewIntro: string;
  scoringMode: SubmissionScoringMode;
  scoringLabel: string;
  /** Build public files + hidden labels. */
  buildData: (rng: () => number) => {
    trainCsv: string;
    testCsv: string;
    sampleCsv: string;
    hiddenCsv: string;
    columnNotes: string;
  };
  solution: string;
};

function makeBinaryFeatureTask(params: {
  nTrain: number;
  nTest: number;
  featureNames: string[];
  /** Linear weights; label = 1 if weighted sum + noise > threshold */
  weights: number[];
  threshold: number;
  noise: number;
  rng: () => number;
}): {
  trainCsv: string;
  testCsv: string;
  sampleCsv: string;
  hiddenCsv: string;
  columnNotes: string;
} {
  const { nTrain, nTest, featureNames, weights, threshold, noise, rng } = params;
  const trainRows: Array<Array<string | number>> = [];
  const testRows: Array<Array<string | number>> = [];
  const hiddenRows: Array<Array<string | number>> = [];
  const sampleRows: Array<Array<string | number>> = [];

  for (let i = 0; i < nTrain + nTest; i++) {
    const feats = featureNames.map(() => Number((rng() * 4 - 1).toFixed(3)));
    const score =
      feats.reduce((s, x, j) => s + x * (weights[j] ?? 0), 0) +
      (rng() - 0.5) * noise;
    const label = score > threshold ? 1 : 0;
    const id = i < nTrain ? `tr${i}` : `te${i - nTrain}`;
    if (i < nTrain) {
      trainRows.push([id, ...feats, label]);
    } else {
      testRows.push([id, ...feats]);
      hiddenRows.push([id, label]);
      sampleRows.push([id, 0]);
    }
  }

  const trainHeaders = ["id", ...featureNames, "label"];
  const testHeaders = ["id", ...featureNames];
  return {
    trainCsv: rowsToCsv(trainHeaders, trainRows),
    testCsv: rowsToCsv(testHeaders, testRows),
    sampleCsv: rowsToCsv(["id", "prediction"], sampleRows),
    hiddenCsv: rowsToCsv(["id", "prediction"], hiddenRows),
    columnNotes: `Kolom fitur: ${featureNames.join(", ")}. Target train: label (0/1). Submit: id,prediction.`,
  };
}

function makeRegressionTask(params: {
  nTrain: number;
  nTest: number;
  featureNames: string[];
  weights: number[];
  intercept: number;
  noise: number;
  rng: () => number;
}): {
  trainCsv: string;
  testCsv: string;
  sampleCsv: string;
  hiddenCsv: string;
  columnNotes: string;
} {
  const { nTrain, nTest, featureNames, weights, intercept, noise, rng } = params;
  const trainRows: Array<Array<string | number>> = [];
  const testRows: Array<Array<string | number>> = [];
  const hiddenRows: Array<Array<string | number>> = [];
  const sampleRows: Array<Array<string | number>> = [];

  for (let i = 0; i < nTrain + nTest; i++) {
    const feats = featureNames.map(() => Number((rng() * 3).toFixed(3)));
    const y = Number(
      (
        intercept +
        feats.reduce((s, x, j) => s + x * (weights[j] ?? 0), 0) +
        (rng() - 0.5) * noise
      ).toFixed(4),
    );
    const id = i < nTrain ? `tr${i}` : `te${i - nTrain}`;
    if (i < nTrain) {
      trainRows.push([id, ...feats, y]);
    } else {
      testRows.push([id, ...feats]);
      hiddenRows.push([id, y]);
      sampleRows.push([id, 0]);
    }
  }

  return {
    trainCsv: rowsToCsv(["id", ...featureNames, "target"], trainRows),
    testCsv: rowsToCsv(["id", ...featureNames], testRows),
    sampleCsv: rowsToCsv(["id", "prediction"], sampleRows),
    hiddenCsv: rowsToCsv(["id", "prediction"], hiddenRows),
    columnNotes: `Kolom fitur: ${featureNames.join(", ")}. Target train: target. Submit: id,prediction (numerik).`,
  };
}

function makeTextClassTask(params: {
  nTrain: number;
  nTest: number;
  posWords: string[];
  negWords: string[];
  rng: () => number;
}): {
  trainCsv: string;
  testCsv: string;
  sampleCsv: string;
  hiddenCsv: string;
  columnNotes: string;
} {
  const { nTrain, nTest, posWords, negWords, rng } = params;
  const fillers = ["the", "a", "of", "and", "to", "in", "is", "for", "on"];
  const trainRows: Array<Array<string | number>> = [];
  const testRows: Array<Array<string | number>> = [];
  const hiddenRows: Array<Array<string | number>> = [];
  const sampleRows: Array<Array<string | number>> = [];

  function sentence(positive: boolean) {
    const pool = positive ? posWords : negWords;
    const words = [
      fillers[Math.floor(rng() * fillers.length)]!,
      pool[Math.floor(rng() * pool.length)]!,
      fillers[Math.floor(rng() * fillers.length)]!,
      pool[Math.floor(rng() * pool.length)]!,
    ];
    return words.join(" ");
  }

  for (let i = 0; i < nTrain + nTest; i++) {
    const label = rng() > 0.45 ? 1 : 0;
    const text = sentence(label === 1);
    const id = i < nTrain ? `tr${i}` : `te${i - nTrain}`;
    if (i < nTrain) {
      trainRows.push([id, text, label]);
    } else {
      testRows.push([id, text]);
      hiddenRows.push([id, label]);
      sampleRows.push([id, 0]);
    }
  }

  return {
    trainCsv: rowsToCsv(["id", "text", "label"], trainRows),
    testCsv: rowsToCsv(["id", "text"], testRows),
    sampleCsv: rowsToCsv(["id", "prediction"], sampleRows),
    hiddenCsv: rowsToCsv(["id", "prediction"], hiddenRows),
    columnNotes:
      "Kolom text (string). Target train: label (0/1). Submit: id,prediction.",
  };
}

const ANALOG_DEFS: AnalogDef[] = [
  // —— 2024 ——
  {
    resourceId: "ioai-2024-athome-ml",
    year: 2024,
    shortName: "Matrix Features",
    storyTitle: "Sensor Matrix Feature Race (IOAI 2024)",
    overviewIntro:
      "Analog latihan dari IOAI 2024 At-Home Feature Engineering: tiap sampel punya vektor sensor; prediksi label biner. Model 'tetap' diganti aturan sederhana di pandas — fokus rekayasa fitur & threshold.",
    scoringMode: "accuracy",
    scoringLabel: "Accuracy",
    buildData: (rng) =>
      makeBinaryFeatureTask({
        nTrain: 40,
        nTest: 16,
        featureNames: ["f0", "f1", "f2", "f3"],
        weights: [1.2, -0.8, 0.5, 0.3],
        threshold: 0.4,
        noise: 0.6,
        rng,
      }),
    solution: `## Pembahasan
Data mengikuti skor linear kasar \`1.2·f0 − 0.8·f1 + 0.5·f2 + 0.3·f3\`.

**Baseline:** di train, hitung skor yang sama (atau korelasi per fitur), pilih threshold yang memaksimalkan akurasi (bisa grid search kasar), terapkan ke test.

**Tips:** normalisasi min-max membantu; jangan overfit threshold ekstrem. Metrik = accuracy.`,
  },
  {
    resourceId: "ioai-2024-athome-nlp",
    year: 2024,
    shortName: "Cipher Class",
    storyTitle: "Ciphered Phrase Classifier (IOAI 2024)",
    overviewIntro:
      "Analog IOAI 2024 At-Home Ciphered LM: klasifikasi frasa 'tersandi' (kata kunci positif/negatif) tanpa model bahasa besar — cukup hitung kata indikatif.",
    scoringMode: "f1_macro",
    scoringLabel: "Macro F1",
    buildData: (rng) =>
      makeTextClassTask({
        nTrain: 36,
        nTest: 14,
        posWords: ["alpha", "bravo", "delta", "echo"],
        negWords: ["zulu", "yankee", "xray", "whiskey"],
        rng,
      }),
    solution: `## Pembahasan
Label 1 cenderung memuat kata \`alpha/bravo/delta/echo\`; label 0 memuat \`zulu/yankee/xray/whiskey\`.

**Baseline:** hitung frekuensi kata positif vs negatif per baris; prediksi kelas mayoritas. Atau bag-of-words + regresi logistik sederhana / aturan threshold.

**Metrik:** macro F1 — jaga keseimbangan kelas saat memilih threshold.`,
  },
  {
    resourceId: "ioai-2024-athome-cv",
    year: 2024,
    shortName: "Style Proxy",
    storyTitle: "Style Steering Proxy (IOAI 2024)",
    overviewIntro:
      "Analog IOAI 2024 At-Home weight steering: tanpa citra/GPU, kita memprediksi 'arah gaya' (0/1) dari embedding fitur numerik yang mewakili dua mode visual.",
    scoringMode: "accuracy",
    scoringLabel: "Accuracy",
    buildData: (rng) =>
      makeBinaryFeatureTask({
        nTrain: 40,
        nTest: 16,
        featureNames: ["emb0", "emb1", "emb2"],
        weights: [0.9, -1.1, 0.4],
        threshold: 0.2,
        noise: 0.5,
        rng,
      }),
    solution: `## Pembahasan
Arah gaya ditentukan terutama oleh \`emb0\` dan \`emb1\` (bertanda berlawanan).

**Baseline:** skor \`0.9·emb0 − 1.1·emb1 + 0.4·emb2\`, threshold ~0.2 (kalibrasi di train).

Ini proxy tabular dari ide "mengarahkan representasi" tanpa mengubah bobot jaringan nyata.`,
  },
  {
    resourceId: "ioai-2024-onsite-ml",
    year: 2024,
    shortName: "Onsite Matrix",
    storyTitle: "On-Site Matrix Regression (IOAI 2024)",
    overviewIntro:
      "Analog IOAI 2024 On-Site ML: versi regresi dari rekayasa fitur matriks — prediksi target kontinu dari fitur sensor.",
    scoringMode: "rmse",
    scoringLabel: "RMSE (dinormalisasi)",
    buildData: (rng) =>
      makeRegressionTask({
        nTrain: 40,
        nTest: 16,
        featureNames: ["m0", "m1", "m2"],
        weights: [2.0, -1.0, 0.5],
        intercept: 1.0,
        noise: 0.4,
        rng,
      }),
    solution: `## Pembahasan
Target ≈ \`1 + 2·m0 − m1 + 0.5·m2\`.

**Baseline:** regresi linear least-squares di pandas/numpy, prediksi test. Atau rata-rata target train sebagai naive baseline (skor rendah).

Metrik RMSE dinormalisasi ke skor 0–1 di grader platform.`,
  },
  {
    resourceId: "ioai-2024-onsite-nlp",
    year: 2024,
    shortName: "Extended Cipher",
    storyTitle: "Extended Cipher Classes (IOAI 2024)",
    overviewIntro:
      "Analog IOAI 2024 On-Site NLP: perluas klasifikasi frasa ke dua kelas (sama seperti at-home) dengan distribusi sedikit berbeda — tetap bag-of-words.",
    scoringMode: "f1_macro",
    scoringLabel: "Macro F1",
    buildData: (rng) =>
      makeTextClassTask({
        nTrain: 40,
        nTest: 16,
        posWords: ["alpha", "charlie", "delta", "foxtrot"],
        negWords: ["zulu", "romeo", "xray", "quebec"],
        rng,
      }),
    solution: `## Pembahasan
Mirip At-Home NLP tetapi kosakata sedikit bergeser (\`charlie/foxtrot\` vs \`romeo/quebec\`).

**Baseline:** lexicon matching / TF-IDF ringan + klasifier linear. Kalibrasi ulang di train; jangan salin threshold dari soal lain.`,
  },
  // —— 2025 ——
  {
    resourceId: "ioai-2025-radar",
    year: 2025,
    shortName: "Radar Proxy",
    storyTitle: "Radar Patch Classifier (IOAI 2025)",
    overviewIntro:
      "Analog IOAI 2025 Radar: tanpa heatmap 3D, tiap baris adalah ringkasan statistik patch radar; prediksi ada objek (1) atau background (0).",
    scoringMode: "f1_macro",
    scoringLabel: "Macro F1",
    buildData: (rng) =>
      makeBinaryFeatureTask({
        nTrain: 48,
        nTest: 18,
        featureNames: ["peak", "energy", "spread", "vel"],
        weights: [1.5, 0.8, -0.6, 0.2],
        threshold: 0.7,
        noise: 0.7,
        rng,
      }),
    solution: `## Pembahasan
Objek non-background punya \`peak\` & \`energy\` lebih tinggi.

**Baseline:** skor \`1.5·peak + 0.8·energy − 0.6·spread + 0.2·vel\`. Karena kelas background sering dominan, optimalkan F1 (bukan hanya accuracy) saat memilih threshold.`,
  },
  {
    resourceId: "ioai-2025-chicken",
    year: 2025,
    shortName: "Counting Proxy",
    storyTitle: "Object Count Regression (IOAI 2025)",
    overviewIntro:
      "Analog IOAI 2025 Chicken Counting: prediksi jumlah objek (kontinu/diskrit) dari fitur citra ringkas — regresi, bukan detektor penuh.",
    scoringMode: "mae",
    scoringLabel: "MAE (dinormalisasi)",
    buildData: (rng) =>
      makeRegressionTask({
        nTrain: 40,
        nTest: 16,
        featureNames: ["density", "blob", "edge"],
        weights: [3.0, 1.5, 0.5],
        intercept: 0.5,
        noise: 0.8,
        rng,
      }),
    solution: `## Pembahasan
Jumlah ≈ \`0.5 + 3·density + 1.5·blob + 0.5·edge\`.

**Baseline:** regresi linear; bulatkan prediksi ke bilangan non-negatif jika ingin. Metrik MAE dinormalisasi di grader.`,
  },
  {
    resourceId: "ioai-2025-concepts",
    year: 2025,
    shortName: "Concepts NLP",
    storyTitle: "Concept Phrase Tagging (IOAI 2025)",
    overviewIntro:
      "Analog IOAI 2025 Concepts: klasifikasi apakah frasa mengandung 'konsep teknis' (1) atau tidak (0) dari teks pendek.",
    scoringMode: "accuracy",
    scoringLabel: "Accuracy",
    buildData: (rng) =>
      makeTextClassTask({
        nTrain: 40,
        nTest: 16,
        posWords: ["gradient", "tensor", "attention", "kernel"],
        negWords: ["weather", "lunch", "music", "travel"],
        rng,
      }),
    solution: `## Pembahasan
Kelas 1 memuat istilah ML (\`gradient/tensor/attention/kernel\`).

**Baseline:** lexicon atau TF-IDF + threshold. Akurasi cukup sebagai metrik karena kelas relatif seimbang.`,
  },
  {
    resourceId: "ioai-2025-restroom",
    year: 2025,
    shortName: "Icon Match",
    storyTitle: "Icon Match Features (IOAI 2025)",
    overviewIntro:
      "Analog IOAI 2025 Restroom Icon Matching: prediksi apakah pasangan fitur ikon cocok (1) dari jarak/embedding proxy numerik.",
    scoringMode: "accuracy",
    scoringLabel: "Accuracy",
    buildData: (rng) =>
      makeBinaryFeatureTask({
        nTrain: 40,
        nTest: 16,
        featureNames: ["sim", "hue_diff", "edge_diff"],
        weights: [2.0, -1.0, -0.5],
        threshold: 0.5,
        noise: 0.55,
        rng,
      }),
    solution: `## Pembahasan
Cocok jika similaritas tinggi dan perbedaan warna/tepi rendah: skor ≈ \`2·sim − hue_diff − 0.5·edge_diff\`.

**Baseline:** threshold di train; atau nearest-centroid di ruang fitur.`,
  },
  {
    resourceId: "ioai-2025-antique",
    year: 2025,
    shortName: "Auth Proxy",
    storyTitle: "Painting Auth Proxy (IOAI 2025)",
    overviewIntro:
      "Analog IOAI 2025 Antique Painting: klasifikasi asli (1) vs palsu (0) dari fitur tekstur/warna tabular.",
    scoringMode: "f1_macro",
    scoringLabel: "Macro F1",
    buildData: (rng) =>
      makeBinaryFeatureTask({
        nTrain: 44,
        nTest: 16,
        featureNames: ["crack", "palette", "stroke", "age"],
        weights: [0.4, 1.0, 0.8, 0.6],
        threshold: 1.0,
        noise: 0.65,
        rng,
      }),
    solution: `## Pembahasan
Lukisan "asli" cenderung skor fitur gabungan lebih tinggi.

**Baseline:** weighted sum + threshold F1-optimal. Perhatikan ketidakseimbangan — jangan hanya maximize accuracy.`,
  },
  // —— 2026 ——
  {
    resourceId: "ioai-2026-find-order",
    year: 2026,
    shortName: "Turn Order",
    storyTitle: "Dialogue Turn Order (IOAI 2026)",
    overviewIntro:
      "Analog IOAI 2026 Find the Order: tiap baris adalah giliran dialog dengan fitur posisi/prosodi; prediksi indeks urutan (regresi) atau skor posisi.",
    scoringMode: "mae",
    scoringLabel: "MAE (dinormalisasi)",
    buildData: (rng) =>
      makeRegressionTask({
        nTrain: 36,
        nTest: 14,
        featureNames: ["t_start", "energy", "speaker"],
        weights: [1.0, 0.2, 0.5],
        intercept: 0,
        noise: 0.3,
        rng,
      }),
    solution: `## Pembahasan
Urutan sangat berkorelasi dengan \`t_start\` (waktu mulai).

**Baseline:** regresi pada \`t_start\` (+ fitur lain). Atau urutkan test berdasarkan \`t_start\` lalu map ke peringkat 0..n-1 sebagai prediksi.`,
  },
  {
    resourceId: "ioai-2026-robot-chasing",
    year: 2026,
    shortName: "Robot Act",
    storyTitle: "Robot Instruction Acts (IOAI 2026)",
    overviewIntro:
      "Analog IOAI 2026 Robot Chasing: prediksi aksi diskrit (0/1) dari fitur observasi grid + skor instruksi.",
    scoringMode: "accuracy",
    scoringLabel: "Accuracy",
    buildData: (rng) =>
      makeBinaryFeatureTask({
        nTrain: 40,
        nTest: 16,
        featureNames: ["dx", "dy", "instr", "wall"],
        weights: [1.0, 0.8, 1.2, -1.5],
        threshold: 0.3,
        noise: 0.5,
        rng,
      }),
    solution: `## Pembahasan
Aksi "kejar" aktif bila instruksi kuat dan tidak terhalang dinding: skor ≈ \`dx + 0.8·dy + 1.2·instr − 1.5·wall\`.

**Baseline:** threshold di train. Variasi: pohon keputusan kedalaman 2 pada \`instr\` dan \`wall\`.`,
  },
  {
    resourceId: "ioai-2026-potato",
    year: 2026,
    shortName: "Semantic Closer",
    storyTitle: "Semantic Closer Guess (IOAI 2026)",
    overviewIntro:
      "Analog IOAI 2026 Potato: dari fitur jarak semantik ke dua kandidat, prediksi mana yang lebih dekat ke target (0 atau 1).",
    scoringMode: "accuracy",
    scoringLabel: "Accuracy",
    buildData: (rng) =>
      makeBinaryFeatureTask({
        nTrain: 40,
        nTest: 16,
        featureNames: ["dist_a", "dist_b", "overlap"],
        weights: [-1.2, 1.2, 0.3],
        threshold: 0,
        noise: 0.4,
        rng,
      }),
    solution: `## Pembahasan
Label 1 ≈ kandidat B lebih dekat: skor \`−1.2·dist_a + 1.2·dist_b + 0.3·overlap\`.

**Baseline:** prediksi \`1 if dist_b < dist_a else 0\` — sering sudah kuat. Metrik accuracy.`,
  },
  {
    resourceId: "ioai-2026-double-agent",
    year: 2026,
    shortName: "Model Disagree",
    storyTitle: "Double Agent Disagreement (IOAI 2026)",
    overviewIntro:
      "Analog IOAI 2026 Double Agent Dilemma: dua model memberi skor; prediksi label benar dengan memanfaatkan ketidaksepakatan.",
    scoringMode: "accuracy",
    scoringLabel: "Accuracy",
    buildData: (rng) =>
      makeBinaryFeatureTask({
        nTrain: 44,
        nTest: 16,
        featureNames: ["cnn_p", "vit_p", "disagree"],
        weights: [0.7, 0.7, -0.4],
        threshold: 0.55,
        noise: 0.35,
        rng,
      }),
    solution: `## Pembahasan
Jika \`cnn_p\` dan \`vit_p\` sepakat tinggi → cenderung label 1. \`disagree\` besar menurunkan kepercayaan.

**Baseline:** rata-rata \`cnn_p\` & \`vit_p\`, threshold ~0.55; atau jika disagree tinggi, ikut model dengan skor lebih ekstrem.`,
  },
  {
    resourceId: "ioai-2026-ghost",
    year: 2026,
    shortName: "Edit Detect",
    storyTitle: "Ghost Edit Detector (IOAI 2026)",
    overviewIntro:
      "Analog IOAI 2026 Ghost of the Machine: deteksi apakah cuplikan teks diedit mesin (1) dari fitur stilometri tabular.",
    scoringMode: "f1_macro",
    scoringLabel: "Macro F1",
    buildData: (rng) =>
      makeBinaryFeatureTask({
        nTrain: 44,
        nTest: 16,
        featureNames: ["perplex", "burst", "punct", "rare"],
        weights: [1.1, 0.6, -0.3, 0.8],
        threshold: 0.9,
        noise: 0.55,
        rng,
      }),
    solution: `## Pembahasan
Teks mesin cenderung perplexity/rare-token lebih tinggi.

**Baseline:** skor \`1.1·perplex + 0.6·burst − 0.3·punct + 0.8·rare\`, pilih threshold yang memaksimalkan macro F1 di train.`,
  },
];

function buildCompetitionSpec(def: AnalogDef, data: ReturnType<AnalogDef["buildData"]>): CompetitionSpec {
  return {
    overview: `## ${def.storyTitle}

${def.overviewIntro}

### Data
${data.columnNotes}

- \`train.csv\` — berlabel  
- \`test.csv\` — tanpa label  
- \`sample_submission.csv\` — format submit  

### Penilaian
Metrik: **${def.scoringLabel}** (\`${def.scoringMode}\`). Kirim CSV \`id,prediction\` untuk semua baris test.

### Catatan
Ini **analog latihan** gaya paper IOAI ${def.year} — cerita & data sintetis baru, bukan dataset resmi.
`,
    scoring: { mode: def.scoringMode, label: def.scoringLabel },
    files: [
      {
        name: "train.csv",
        description: "Data latih berlabel",
        content: data.trainCsv,
      },
      {
        name: "test.csv",
        description: "Data uji tanpa label",
        content: data.testCsv,
      },
      {
        name: "sample_submission.csv",
        description: "Contoh format submission",
        content: data.sampleCsv,
      },
    ],
    submission: {
      idColumn: "id",
      targetColumn: "prediction",
      columns: ["id", "prediction"],
    },
    hiddenLabelsCsv: data.hiddenCsv,
  };
}

let cached: Problem[] | null = null;

export function getIoaiAnalogProblems(): Problem[] {
  if (cached) return cached;
  const problems: Problem[] = [];

  for (const def of ANALOG_DEFS) {
    const pack = getIoaiYearPack(def.year).find(
      (s) => s.resourceId === def.resourceId,
    );
    const track: TrackId = pack?.track ?? "B";
    const topic = pack?.topic ?? "supervised-learning";
    const rng = mulberry32(
      def.year * 1000 + def.resourceId.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
    );
    const data = def.buildData(rng);
    const id = IOAI_ANALOG_PROBLEM_BY_RESOURCE[def.resourceId]!;
    problems.push({
      id,
      title: def.storyTitle,
      track,
      topic,
      difficulty: 4,
      answerType: "notebook_submission",
      stem: `Latihan Kaggle-style analog paper IOAI ${def.year} · ${def.shortName}. Kerjakan di tab Notebook, Submit CSV. Pembahasan terbuka setelah submit.`,
      answer: "lihat submission",
      solution: def.solution,
      weight: 5,
      tags: [
        "kaggle-style",
        "ioai-analog",
        `ioai-${def.year}`,
        def.resourceId,
      ],
      source: "curated",
      competitionSpec: buildCompetitionSpec(def, data),
    });
  }

  cached = problems;
  return problems;
}

export function getIoaiAnalogProblem(id: string): Problem | undefined {
  return getIoaiAnalogProblems().find((p) => p.id === id);
}

export function listAnalogProblemIdsForYear(year: IoaiPackYear): string[] {
  return IOAI_YEAR_PACK_IDS[year].map(
    (rid) => IOAI_ANALOG_PROBLEM_BY_RESOURCE[rid]!,
  );
}
