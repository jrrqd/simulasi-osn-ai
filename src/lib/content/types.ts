export type TrackId = "A" | "B" | "C" | "D";

export type AnswerType =
  | "numeric"
  | "short_string"
  | "multi_part"
  | "python_output"
  | "mcq";

export type ProblemPart = {
  id: string;
  prompt: string;
  answerType: AnswerType;
  answer: string | number | string[];
  tolerance?: number;
  choices?: string[];
  points?: number;
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
};

export type Lesson = {
  id: string;
  track: TrackId;
  topic: string;
  title: string;
  summary: string;
  body: string;
  checkQuestions: {
    id: string;
    prompt: string;
    answer: string;
    explanation: string;
  }[];
};

export type MockExam = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  problemIds: string[];
};

export const TRACKS: Record<
  TrackId,
  { name: string; description: string; topics: string[] }
> = {
  A: {
    name: "Fondasi",
    description: "Python, statistika, peluang, aljabar linier, optimasi",
    topics: [
      "python-dasar",
      "statistika",
      "probabilitas",
      "aljabar-linier",
      "optimasi",
    ],
  },
  B: {
    name: "Machine Learning Klasik",
    description: "Supervised/unsupervised learning, metrik, validasi",
    topics: [
      "supervised-learning",
      "unsupervised-learning",
      "evaluasi-model",
      "feature-engineering",
    ],
  },
  C: {
    name: "Jaringan Syaraf Tiruan",
    description: "Perceptron, backprop, aktivasi, MLP, regularisasi",
    topics: [
      "perceptron",
      "backpropagation",
      "aktivasi-loss",
      "mlp",
      "regularisasi",
    ],
  },
  D: {
    name: "CV & NLP",
    description: "Konvolusi, pooling, TF-IDF, embedding, attention",
    topics: [
      "konvolusi",
      "klasifikasi-citra",
      "tfidf-embedding",
      "transformer-dasar",
    ],
  },
};

export const TOPIC_LABELS: Record<string, string> = {
  "python-dasar": "Python Dasar",
  statistika: "Statistika",
  probabilitas: "Probabilitas",
  "aljabar-linier": "Aljabar Linier",
  optimasi: "Optimasi",
  "supervised-learning": "Supervised Learning",
  "unsupervised-learning": "Unsupervised Learning",
  "evaluasi-model": "Evaluasi Model",
  "feature-engineering": "Feature Engineering",
  perceptron: "Perceptron",
  backpropagation: "Backpropagation",
  "aktivasi-loss": "Aktivasi & Loss",
  mlp: "MLP",
  regularisasi: "Regularisasi",
  konvolusi: "Konvolusi",
  "klasifikasi-citra": "Klasifikasi Citra",
  "tfidf-embedding": "TF-IDF & Embedding",
  "transformer-dasar": "Transformer Dasar",
};
