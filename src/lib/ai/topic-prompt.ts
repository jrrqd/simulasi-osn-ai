import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";
import {
  TOPIC_PROMPT_MAX_LEN,
  TOPIC_PROMPT_MIN_LEN,
} from "@/lib/ai/curated-mock-size";

export { TOPIC_PROMPT_MAX_LEN, TOPIC_PROMPT_MIN_LEN };

/** Map free-text topic preference to known topic ids (best-effort). */
export function matchTopicsFromPrompt(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const matched: string[] = [];
  for (const [id, label] of Object.entries(TOPIC_LABELS)) {
    const idSpaced = id.replace(/-/g, " ");
    const idCompact = id.replace(/-/g, "");
    if (
      lower.includes(id) ||
      lower.includes(idSpaced) ||
      lower.includes(idCompact) ||
      lower.includes(label.toLowerCase())
    ) {
      matched.push(id);
    }
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

  const track = fallbackTrack && TRACKS[fallbackTrack] ? fallbackTrack : "B";
  return TRACKS[track].topics.map((topic) => ({ track, topic }));
}
