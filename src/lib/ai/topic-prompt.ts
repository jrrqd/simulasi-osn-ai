import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";
import {
  TOPIC_PROMPT_MAX_LEN,
  TOPIC_PROMPT_MIN_LEN,
} from "@/lib/ai/curated-mock-size";

export { TOPIC_PROMPT_MAX_LEN, TOPIC_PROMPT_MIN_LEN };

/** Normalize free text so "aktivasi/loss" matches "Aktivasi & Loss". */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[&/_+,|]+/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TOPIC_ALIASES: Record<string, string[]> = {
  "python-dasar": ["python", "dasar python", "pemrograman python"],
  statistika: ["statistik", "statistics", "mean median"],
  probabilitas: ["probability", "peluang", "bayes"],
  "aljabar-linier": ["aljabar linear", "linear algebra", "matriks", "matrix"],
  optimasi: ["optimization", "gradient descent"],
  "aljabar-linier-lanjut": [
    "svd",
    "eigen",
    "eigenvalue",
    "eigenvector",
    "low rank",
    "matrix norm",
    "dekomposisi",
  ],
  "optimasi-lanjut": [
    "adam",
    "adamw",
    "momentum",
    "learning rate schedule",
    "convex",
    "convexity",
    "sgd vs adam",
  ],
  "supervised-learning": [
    "supervised",
    "regresi",
    "klasifikasi",
    "regression",
    "classification",
  ],
  "unsupervised-learning": [
    "unsupervised",
    "clustering",
    "k-means",
    "kmeans",
    "pca",
  ],
  "evaluasi-model": [
    "evaluasi",
    "metrik",
    "precision",
    "recall",
    "f1 score",
    "confusion matrix",
    "validasi",
    "cross validation",
  ],
  "feature-engineering": ["feature engineering", "fitur", "encoding", "scaling"],
  "pohon-keputusan": [
    "decision tree",
    "pohon keputusan",
    "cart",
    "id3",
    "gini",
    "entropy impurity",
    "pruning",
  ],
  ensemble: [
    "bagging",
    "random forest",
    "boosting",
    "xgboost",
    "gradient boosting",
    "gbdt",
  ],
  svm: [
    "support vector",
    "kernel trick",
    "soft margin",
    "rbf kernel",
    "margin classifier",
  ],
  perceptron: ["linear classifier"],
  backpropagation: ["backprop", "backward pass", "gradien mundur"],
  "aktivasi-loss": [
    "aktivasi",
    "activation",
    "loss function",
    "fungsi loss",
    "relu",
    "sigmoid",
    "softmax",
    "cross entropy",
  ],
  mlp: ["multi layer", "multilayer", "feedforward", "jaringan berlapis"],
  regularisasi: ["regularization", "dropout", "weight decay"],
  "cnn-arsitektur": [
    "resnet",
    "vgg",
    "alexnet",
    "lenet",
    "skip connection",
    "receptive field",
    "arsitektur cnn",
  ],
  "rnn-lstm": [
    "rnn",
    "lstm",
    "gru",
    "bptt",
    "vanishing gradient",
    "seq2seq",
    "sequential model",
  ],
  konvolusi: ["convolution", "cnn", "filter citra"],
  "klasifikasi-citra": ["image classification", "citra", "gambar"],
  "tfidf-embedding": ["tfidf", "tf idf", "embedding", "word2vec"],
  "transformer-dasar": ["transformer", "self attention", "attention mechanism"],
  "deteksi-segmentasi": [
    "yolo",
    "faster r-cnn",
    "object detection",
    "iou",
    "map",
    "segmentation",
    "u-net",
    "unet",
  ],
  "transformer-lanjut": [
    "bert",
    "gpt",
    "multi head",
    "positional encoding",
    "bpe",
    "wordpiece",
    "fine tuning",
    "pretraining",
  ],
};

/** Map free-text topic preference to known topic ids (best-effort). */
export function matchTopicsFromPrompt(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const normalized = normalizeForMatch(prompt);
  const matched: string[] = [];

  for (const [id, label] of Object.entries(TOPIC_LABELS)) {
    const idSpaced = id.replace(/-/g, " ");
    const idCompact = id.replace(/-/g, "");
    const labelNorm = normalizeForMatch(label);
    const aliases = TOPIC_ALIASES[id] ?? [];

    const hit =
      lower.includes(id) ||
      lower.includes(idSpaced) ||
      lower.includes(idCompact) ||
      lower.includes(label.toLowerCase()) ||
      (labelNorm.length >= 3 && normalized.includes(labelNorm)) ||
      (idSpaced.length >= 4 && normalized.includes(idSpaced)) ||
      aliases.some(
        (alias) =>
          lower.includes(alias) || normalized.includes(normalizeForMatch(alias)),
      );

    if (hit) matched.push(id);
  }

  return matched;
}

export function normalizeTopicPrompt(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const text = String(raw).trim().replace(/\s+/g, " ");
  if (!text) return undefined;
  return text.slice(0, TOPIC_PROMPT_MAX_LEN);
}

export function findTrackForTopic(topic: string): TrackId | undefined {
  for (const track of Object.keys(TRACKS) as TrackId[]) {
    if (TRACKS[track].topics.includes(topic)) return track;
  }
  return undefined;
}

/**
 * Infer a sensible fallback track when the brief mentions neural/CV/ML
 * keywords but no official topic id matched.
 */
export function inferFallbackTrack(topicPrompt: string): TrackId {
  const n = normalizeForMatch(topicPrompt);
  if (
    /(backprop|aktivasi|perceptron|mlp|neural|jaringan|regularisasi|dropout|resnet|lstm|rnn|cnn arsitektur)/.test(
      n,
    )
  ) {
    return "C";
  }
  if (
    /(konvolusi|cnn|citra|image|tfidf|embedding|transformer|attention|nlp|yolo|bert|gpt|segmentasi|deteksi)/.test(
      n,
    )
  ) {
    return "D";
  }
  if (
    /(python|statistika|statistik|probabilitas|peluang|aljabar|matriks|optimasi|svd|eigen|adam)/.test(
      n,
    )
  ) {
    return "A";
  }
  if (
    /(supervised|unsupervised|regresi|klasifikasi|clustering|evaluasi|feature|metrik|svm|ensemble|random forest|boosting|pohon|decision tree)/.test(
      n,
    )
  ) {
    return "B";
  }
  return "B";
}

/** Build a rotating list of {track, topic} from a topic prompt. */
export function topicPairsFromPrompt(
  topicPrompt: string,
  fallbackTrack?: TrackId,
): { track: TrackId; topic: string }[] {
  const matched = matchTopicsFromPrompt(topicPrompt);
  const pairs: { track: TrackId; topic: string }[] = [];
  for (const topic of matched) {
    const track = findTrackForTopic(topic);
    if (track) pairs.push({ track, topic });
  }
  if (pairs.length > 0) return pairs;

  const track =
    fallbackTrack && TRACKS[fallbackTrack]
      ? fallbackTrack
      : inferFallbackTrack(topicPrompt);
  return TRACKS[track].topics.map((topic) => ({ track, topic }));
}
