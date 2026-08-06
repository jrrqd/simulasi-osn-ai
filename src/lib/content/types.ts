export type TrackId = "A" | "B" | "C" | "D";

export type AnswerType =
  | "numeric"
  | "short_string"
  | "multi_part"
  | "python_output"
  | "codeSpec"
  | "mcq";

/** Strict answer format for numeric short-fill (OSN AI 2026). */
export type NumericFormat =
  | "integer"
  | "decimal"
  | "space_separated"
  | "comma_separated";

export type CodeSpecTestCase = {
  input: string;
  expectedOutput: string;
  weight?: number;
};

export type CodeSpec = {
  /** Full program containing lockedMarkers open/close. */
  skeleton: string;
  lockedMarkers?: { open: string; close: string };
  /**
   * Optional 1-based inclusive line ranges that must stay locked.
   * Preferred enforcement is lockedMarkers; ranges are converted to
   * markers when markers are missing (see ensureCodeSpecMarkers).
   */
  lockedRanges?: [number, number][];
  /** At least 3 cases for non-legacy coding problems. */
  testCases: CodeSpecTestCase[];
  timeLimitMs: number;
  memoryLimitMb: number;
  forbiddenImports?: string[];
};

/** Resolve numericFormat with expectedFormat alias. */
export function resolveNumericFormat(problem: {
  numericFormat?: NumericFormat;
  expectedFormat?: NumericFormat;
}): NumericFormat | undefined {
  return problem.numericFormat ?? problem.expectedFormat;
}

/** Infer multi-box count from answer tokens when format is separated. */
export function inferNumericPartCount(
  format: NumericFormat | undefined,
  answer: string | number | string[] | undefined,
): number | undefined {
  if (format !== "space_separated" && format !== "comma_separated") {
    return undefined;
  }
  const sep = format === "space_separated" ? " " : ",";
  const raw = Array.isArray(answer)
    ? answer.map(String).join(sep)
    : String(answer ?? "");
  const tokens = raw
    .split(sep)
    .map((t) => t.trim())
    .filter(Boolean);
  return tokens.length >= 2 ? tokens.length : undefined;
}

export type ProblemPart = {
  id: string;
  prompt: string;
  answerType: AnswerType;
  answer: string | number | string[];
  tolerance?: number;
  choices?: string[];
  points?: number;
};

export type ProblemFigure = {
  id: string;
  alt?: string;
  diagram: unknown;
  svg: string;
};

export type Problem = {
  id: string;
  title: string;
  track: TrackId;
  topic: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  answerType: AnswerType;
  stem: string;
  answer?: string | number | string[];
  tolerance?: number;
  choices?: string[];
  parts?: ProblemPart[];
  solution: string;
  tags?: string[];
  source?: "curated" | "ai";
  starterCode?: string;
  /** AI-rendered SVG figures referenced from stem markdown. */
  figures?: ProblemFigure[];
  /** Strict format for numeric answers (OSN AI 2026). */
  numericFormat?: NumericFormat;
  /** Per-question weight (coding default 2, others default 1). */
  weight?: number;
  /** Coding with locked skeleton + multi test cases. */
  codeSpec?: CodeSpec;
  /**
   * Alias of numericFormat (plan name: expectedFormat).
   * Prefer numericFormat; both accepted at load/score time.
   */
  expectedFormat?: NumericFormat;
  /**
   * Part count for space/comma separated answers (UI multi-box).
   * Inferred from answer at load when omitted.
   */
  numericPartCount?: number;
  /**
   * Soft flag for bank items without OSN-2026 fields.
   * Scored via legacy (forgiving) path.
   */
  legacy?: boolean;
};

/** Mini active-recall item inside a lesson (OSN-aligned formats). */
export type CheckQuestionAnswerType = "numeric" | "short_string" | "mcq";

export type CheckQuestion = {
  id: string;
  prompt: string;
  answerType: CheckQuestionAnswerType;
  answer: string | number | string[];
  choices?: string[];
  tolerance?: number;
  /** Optional strict numeric format (OSN AI 2026). */
  numericFormat?: NumericFormat;
  explanation: string;
  difficulty?: 1 | 2 | 3;
  conceptTags?: string[];
  hints?: string[];
  /** Soft-deleted AI/admin extras are filtered at load time. */
  hidden?: boolean;
  source?: "curated" | "ai" | "admin";
};

export type Lesson = {
  id: string;
  track: TrackId;
  topic: string;
  title: string;
  summary: string;
  body: string;
  checkQuestions: CheckQuestion[];
};

export type MockExam = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  problemIds: string[];
  /** ICPC-style wrong-submit penalty as tie-breaker (default true for AI mocks). */
  penaltyEnabled?: boolean;
  /** Minutes added per wrong submit on a eventually-solved problem (default 1). */
  penaltyMinutesPerWrong?: number;
};

export const TRACKS: Record<
  TrackId,
  { name: string; description: string; topics: string[] }
> = {
  A: {
    name: "Fondasi",
    description:
      "Python, statistika, peluang, aljabar linier, optimasi (dasar + lanjut)",
    topics: [
      "python-dasar",
      "statistika",
      "probabilitas",
      "aljabar-linier",
      "optimasi",
      "aljabar-linier-lanjut",
      "optimasi-lanjut",
    ],
  },
  B: {
    name: "Machine Learning Klasik",
    description:
      "Supervised/unsupervised, metrik, pohon, ensemble, SVM",
    topics: [
      "supervised-learning",
      "unsupervised-learning",
      "evaluasi-model",
      "feature-engineering",
      "pohon-keputusan",
      "ensemble",
      "svm",
    ],
  },
  C: {
    name: "Jaringan Syaraf Tiruan",
    description:
      "Perceptron, backprop, MLP, regularisasi, arsitektur CNN, RNN/LSTM",
    topics: [
      "perceptron",
      "backpropagation",
      "aktivasi-loss",
      "mlp",
      "regularisasi",
      "cnn-arsitektur",
      "rnn-lstm",
    ],
  },
  D: {
    name: "CV & NLP",
    description:
      "Konvolusi, klasifikasi citra, TF-IDF, attention, deteksi, transformer lanjut",
    topics: [
      "konvolusi",
      "klasifikasi-citra",
      "tfidf-embedding",
      "transformer-dasar",
      "deteksi-segmentasi",
      "transformer-lanjut",
    ],
  },
};

export const TOPIC_LABELS: Record<string, string> = {
  "python-dasar": "Python Dasar",
  statistika: "Statistika",
  probabilitas: "Probabilitas",
  "aljabar-linier": "Aljabar Linier",
  optimasi: "Optimasi",
  "aljabar-linier-lanjut": "Aljabar Linier Lanjut",
  "optimasi-lanjut": "Optimasi Lanjut",
  "supervised-learning": "Supervised Learning",
  "unsupervised-learning": "Unsupervised Learning",
  "evaluasi-model": "Evaluasi Model",
  "feature-engineering": "Feature Engineering",
  "pohon-keputusan": "Pohon Keputusan",
  ensemble: "Ensemble",
  svm: "SVM",
  perceptron: "Perceptron",
  backpropagation: "Backpropagation",
  "aktivasi-loss": "Aktivasi & Loss",
  mlp: "MLP",
  regularisasi: "Regularisasi",
  "cnn-arsitektur": "Arsitektur CNN",
  "rnn-lstm": "RNN & LSTM",
  konvolusi: "Konvolusi",
  "klasifikasi-citra": "Klasifikasi Citra",
  "tfidf-embedding": "TF-IDF & Embedding",
  "transformer-dasar": "Transformer Dasar",
  "deteksi-segmentasi": "Deteksi & Segmentasi",
  "transformer-lanjut": "Transformer Lanjut",
};

/** Default weight: coding 2×, everything else 1× (OSN AI 2026). */
export function defaultProblemWeight(problem: {
  answerType?: string | null;
  weight?: number | null;
  codeSpec?: unknown;
}): number {
  if (typeof problem.weight === "number" && Number.isFinite(problem.weight)) {
    return Math.max(0, problem.weight);
  }
  if (problem.answerType === "codeSpec" || problem.codeSpec) return 2;
  return 1;
}

export function isCodingProblem(problem: {
  answerType?: string | null;
  codeSpec?: unknown;
}): boolean {
  return (
    problem.answerType === "codeSpec" ||
    Boolean(problem.codeSpec) ||
    problem.answerType === "python_output"
  );
}
