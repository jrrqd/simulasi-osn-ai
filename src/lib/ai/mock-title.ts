import {
  parseDifficultyMode,
  type DifficultyMode,
} from "@/lib/ai/difficulty";
import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";

const TITLE_MAX = 60;

const TRACK_SHORT: Record<TrackId, string> = {
  A: "Fondasi",
  B: "ML Klasik",
  C: "Neural Net",
  D: "CV & NLP",
};

function clipTitle(text: string, max = TITLE_MAX) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function difficultyPhrase(mode: DifficultyMode): string {
  if (mode === "easy") return "mudah";
  if (mode === "medium") return "sedang";
  if (mode === "hard") return "sulit";
  if (mode === "semifinal") return "semifinal";
  if (mode === "final") return "final IOAI";
  return "campuran kesulitan";
}

function trackPhrase(track: TrackId | "ALL" | string | undefined): string | null {
  if (!track || track === "ALL") return null;
  if (TRACKS[track as TrackId]) return TRACK_SHORT[track as TrackId];
  return null;
}

function topicFocusLabel(
  topicLabels?: string[],
  topicPrompt?: string,
): string | null {
  if (topicLabels && topicLabels.length > 0) {
    return topicLabels.slice(0, 3).join(" & ");
  }
  const prompt = topicPrompt?.trim();
  if (!prompt) return null;
  // Prefer a short leading phrase before punctuation.
  const phrase = prompt
    .split(/[.;\n]/)[0]!
    .replace(/^(fokus|utamakan|latihan|soal|brief)\s*[:\-]?\s*/i, "")
    .trim();
  if (!phrase) return null;
  return phrase.length > 42 ? `${phrase.slice(0, 41).trimEnd()}…` : phrase;
}

export type NaturalMockTitleInput = {
  kind: "ai" | "curated_assembled";
  generationMode?: "standard" | "custom";
  track?: TrackId | "ALL" | string;
  difficultyMode?: DifficultyMode | string;
  count?: number;
  size?: "quick" | "half" | "full" | "kaggle" | "kaggle-150" | "kaggle-300" | string;
  topicLabels?: string[];
  topicPrompt?: string;
};

/** Short, natural Indonesian exam-style title (no soal count / duration). */
export function buildNaturalMockTitle(input: NaturalMockTitleInput): string {
  const mode = parseDifficultyMode(input.difficultyMode ?? "normal");
  const diff = difficultyPhrase(mode);
  const trackLabel = trackPhrase(input.track);
  const focus = topicFocusLabel(input.topicLabels, input.topicPrompt);
  const isFull = (input.count ?? 0) >= 40;
  const isKaggle =
    input.size === "kaggle" ||
    input.size === "kaggle-150" ||
    input.size === "kaggle-300";
  const isCustom = input.generationMode === "custom" || Boolean(focus);
  const curated = input.kind === "curated_assembled";

  let title: string;

  if (input.size === "kaggle-300") {
    title = trackLabel
      ? `Tryout Final IOAI ${trackLabel} · 5 jam`
      : "Tryout Final IOAI · 5 kompetisi · 5 jam";
  } else if (isKaggle) {
    title = trackLabel
      ? `Tryout Kaggle/IOAI ${trackLabel} · 150 menit`
      : "Tryout Kaggle/IOAI · 3 coding · 150 menit";
  } else if (isCustom && focus) {
    title = curated ? `Paket curated: ${focus}` : `Fokus ${focus}`;
  } else if (isCustom) {
    title = curated ? "Paket curated — fokus topik" : "Latihan fokus topik";
  } else if (curated) {
    title = trackLabel
      ? `Paket curated ${trackLabel} — ${diff}`
      : `Paket curated — ${diff}`;
  } else if (trackLabel) {
    title = isFull
      ? `Tryout ${trackLabel} — ${diff}`
      : `Latihan ${trackLabel} — ${diff}`;
  } else if (isFull) {
    title = `Tryout penuh lintas track — ${diff}`;
  } else {
    title = `Latihan lintas track — ${diff}`;
  }

  return clipTitle(title);
}

const GENERIC_TITLE_RE = /^(Simulasi AI|Simulasi curated)\s*·/i;

function topicsFromDescription(description?: string): string[] {
  if (!description) return [];
  const labels: string[] = [];
  for (const [id, label] of Object.entries(TOPIC_LABELS)) {
    if (
      description.toLowerCase().includes(label.toLowerCase()) ||
      description.toLowerCase().includes(id.replace(/-/g, " "))
    ) {
      labels.push(label);
    }
  }
  // Also catch "Fokus: A, B" / "mengikuti brief: ..."
  const fokus = description.match(
    /(?:Fokus|fokus topik|preferensi|brief)\s*[:：]?\s*(.+)$/i,
  );
  if (fokus?.[1] && labels.length === 0) {
    const raw = fokus[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    return raw.slice(0, 3);
  }
  return labels.slice(0, 3);
}

export type DisplayMockTitleInput = {
  title: string;
  description?: string;
  source?: "curated" | "ai";
  kind?: "ai" | "curated_assembled";
  track?: string;
  difficultyMode?: string;
  problemIds?: string[];
};

/**
 * Beautify already-saved generic template titles using mock metadata.
 * Leaves LLM/official titles unchanged.
 */
export function displayMockTitle(mock: DisplayMockTitleInput): string {
  const stored = mock.title?.trim() || "Simulasi";
  if (!GENERIC_TITLE_RE.test(stored)) return stored;

  const kind =
    mock.kind === "curated_assembled" ||
    stored.toLowerCase().startsWith("simulasi curated")
      ? "curated_assembled"
      : "ai";

  const topicLabels = topicsFromDescription(mock.description);
  const generationMode: "standard" | "custom" =
    /custom|fokus|brief|preferensi/i.test(stored + (mock.description ?? "")) ||
    topicLabels.length > 0
      ? "custom"
      : "standard";

  // Prefer topic labels embedded in the old title after "Custom ·"
  const customMatch = stored.match(/Custom(?:\s*topik)?(?:\s*·\s*(.+))?$/i);
  if (customMatch?.[1] && topicLabels.length === 0) {
    topicLabels.push(
      ...customMatch[1]
        .split(/[,&]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3),
    );
  }

  return buildNaturalMockTitle({
    kind,
    generationMode,
    track: mock.track,
    difficultyMode: mock.difficultyMode,
    count: mock.problemIds?.length,
    topicLabels: topicLabels.length > 0 ? topicLabels : undefined,
  });
}
