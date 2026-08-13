import type { IoaiDomain } from "@/lib/content/resource-types";
import { TRACKS, TOPIC_LABELS, type TrackId } from "@/lib/content/types";

/** IOAI Syllabus 2025 pillars — matches syllabus-2025 catalog entry domains. */
export const IOAI_SYLLABUS_DOMAINS = [
  "python",
  "ml",
  "cv",
  "nlp",
  "ethics",
] as const satisfies readonly IoaiDomain[];

export type IoaiSyllabusDomain = (typeof IOAI_SYLLABUS_DOMAINS)[number];

/** Anchor topics from official IOAI Syllabus 2025 entry. */
export const IOAI_SYLLABUS_ANCHOR_TOPICS = [
  "python-dasar",
  "supervised-learning",
  "cnn-arsitektur",
  "transformer-dasar",
] as const;

/** Map each IOAI domain → app track topic slugs (validated against TRACKS). */
export const IOAI_DOMAIN_TOPIC_MAP: Record<
  IoaiSyllabusDomain,
  readonly string[]
> = {
  python: [
    "python-dasar",
    "statistika",
    "probabilitas",
    "aljabar-linier",
  ],
  ml: [
    "supervised-learning",
    "unsupervised-learning",
    "evaluasi-model",
    "feature-engineering",
    "ensemble",
    "pohon-keputusan",
    "svm",
  ],
  cv: [
    "konvolusi",
    "klasifikasi-citra",
    "cnn-arsitektur",
    "deteksi-segmentasi",
  ],
  nlp: [
    "tfidf-embedding",
    "transformer-dasar",
    "transformer-lanjut",
    "rnn-lstm",
  ],
  /** Ethics has no dedicated track topic — proxy via evaluation / feature fairness. */
  ethics: ["evaluasi-model", "feature-engineering"],
};

const ANCHOR_SET = new Set<string>(IOAI_SYLLABUS_ANCHOR_TOPICS);

/** Flattened, deduplicated pool for topic restriction. */
export const IOAI_SYLLABUS_TOPICS: readonly string[] = Array.from(
  new Set(Object.values(IOAI_DOMAIN_TOPIC_MAP).flat()),
);

const IOAI_TOPIC_SET = new Set<string>(IOAI_SYLLABUS_TOPICS);

const ALL_TRACK_TOPICS = new Set(
  (Object.keys(TRACKS) as TrackId[]).flatMap((t) => TRACKS[t].topics),
);

/** Topics that appear in IOAI map but are missing from TRACKS (should be empty). */
export function invalidIoaiSyllabusTopics(): string[] {
  return IOAI_SYLLABUS_TOPICS.filter((t) => !ALL_TRACK_TOPICS.has(t));
}

export function isIoaiSyllabusTopic(topic: string): boolean {
  return IOAI_TOPIC_SET.has(topic);
}

export function pickIoaiDomainForSlot(slotIndex: number): IoaiSyllabusDomain {
  const i = ((slotIndex % IOAI_SYLLABUS_DOMAINS.length) +
    IOAI_SYLLABUS_DOMAINS.length) %
    IOAI_SYLLABUS_DOMAINS.length;
  return IOAI_SYLLABUS_DOMAINS[i]!;
}

export function ioaiDomainForTopic(topic: string): IoaiSyllabusDomain | undefined {
  for (const domain of IOAI_SYLLABUS_DOMAINS) {
    if (IOAI_DOMAIN_TOPIC_MAP[domain].includes(topic)) return domain;
  }
  return undefined;
}

export function topicWeightForIoaiSyllabus(
  domain: IoaiSyllabusDomain,
  topic: string,
): number {
  if (!IOAI_DOMAIN_TOPIC_MAP[domain].includes(topic)) return 0;
  if (ANCHOR_SET.has(topic)) return 2.0;
  return 1.0;
}

function pickWeightedFromPool(pool: { topic: string; weight: number }[]): string {
  if (pool.length === 0) return IOAI_SYLLABUS_TOPICS[0]!;
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.random() * total;
  for (const entry of pool) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.topic;
  }
  return pool[pool.length - 1]!.topic;
}

/**
 * Pick a topic for a slot, rotating IOAI domains for balanced coverage.
 * Prefer topics that also exist in `availableTopics` (e.g. current track).
 */
export function pickIoaiSyllabusTopic(
  availableTopics: string[],
  slotIndex: number,
  preferred?: string,
): string {
  if (preferred && availableTopics.includes(preferred) && isIoaiSyllabusTopic(preferred)) {
    return preferred;
  }

  const domain = pickIoaiDomainForSlot(slotIndex);
  const domainTopics = IOAI_DOMAIN_TOPIC_MAP[domain];
  const availableSet = new Set(availableTopics);

  const inTrack = domainTopics.filter((t) => availableSet.has(t));
  if (inTrack.length > 0) {
    return pickWeightedFromPool(
      inTrack.map((topic) => ({
        topic,
        weight: topicWeightForIoaiSyllabus(domain, topic),
      })),
    );
  }

  // Track has no topics for this domain — fall back to any IOAI topic on the track.
  const anyOnTrack = availableTopics.filter((t) => isIoaiSyllabusTopic(t));
  if (anyOnTrack.length > 0) {
    return pickWeightedFromPool(
      anyOnTrack.map((topic) => ({
        topic,
        weight: ANCHOR_SET.has(topic) ? 2 : 1,
      })),
    );
  }

  // Last resort: full domain pool (caller may use track=ALL / cross-track).
  return pickWeightedFromPool(
    domainTopics.map((topic) => ({
      topic,
      weight: topicWeightForIoaiSyllabus(domain, topic),
    })),
  );
}

/** Find a track that contains the given topic (for cross-track IOAI planning). */
export function trackForIoaiTopic(topic: string): TrackId | undefined {
  for (const track of Object.keys(TRACKS) as TrackId[]) {
    if (TRACKS[track].topics.includes(topic)) return track;
  }
  return undefined;
}

/** Prompt block injected when difficultyMode === "final". */
export function buildIoaiSyllabusStandardsBlock(): string {
  const domainLines = IOAI_SYLLABUS_DOMAINS.map((domain) => {
    const topics = IOAI_DOMAIN_TOPIC_MAP[domain]
      .map((t) => TOPIC_LABELS[t] ?? t)
      .join(", ");
    return `- ${domain}: ${topics}`;
  }).join("\n");

  return `## Standar silabus IOAI 2025 (mode Final)
Ikuti standar kompetisi internasional IOAI — bukan sekadar soal hafalan:
- Tekankan penerapan konsep pada data/kasus konkret (dataset kecil realistis bila relevan).
- Cantumkan metrik evaluasi secara eksplisit (akurasi, F1, RMSE, MAE, dll.) bila soal menilai model/prediksi.
- Hindari soal yang hanya menguji definisi istilah tanpa aplikasi.
- Pertimbangkan aspek etika AI / fairness / bias bila topik evaluasi atau feature engineering.
- Buat ORISINAL; jangan salin soal atau dataset dari arsip IOAI.

Pilar silabus IOAI dan topik terkait:
${domainLines}`;
}
