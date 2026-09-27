export const LEARNING_RECORD_STATUSES = [
  "understood",
  "struggling",
  "corrected_misconception",
] as const;

export type LearningRecordStatus =
  (typeof LEARNING_RECORD_STATUSES)[number];

export type ParsedLearningRecord = {
  status: LearningRecordStatus;
  topic: string | null;
  note: string;
};

/** Matches a trailing machine marker: [[LR|status=...|topic=...|note=...]] */
export const LEARNING_RECORD_MARKER_RE =
  /\[\[LR\|([^\]]+)\]\]\s*$/m;

const STATUS_SET = new Set<string>(LEARNING_RECORD_STATUSES);

export function isLearningRecordStatus(
  value: unknown,
): value is LearningRecordStatus {
  return typeof value === "string" && STATUS_SET.has(value);
}

export function parseLearningRecordMarker(
  text: string,
): ParsedLearningRecord | null {
  const match = text.match(LEARNING_RECORD_MARKER_RE);
  if (!match) return null;
  const fields = Object.fromEntries(
    match[1].split("|").map((part) => {
      const eqIdx = part.indexOf("=");
      if (eqIdx < 0) return [part.trim(), ""];
      return [
        part.slice(0, eqIdx).trim(),
        part.slice(eqIdx + 1).trim(),
      ];
    }),
  ) as Record<string, string>;

  if (!isLearningRecordStatus(fields.status)) return null;
  const note = (fields.note ?? "").trim().slice(0, 120);
  if (!note) return null;
  const topic = (fields.topic ?? "").trim().slice(0, 80) || null;
  return { status: fields.status, topic, note };
}

/** Remove learning-record markers from assistant text shown to students. */
export function stripLearningRecordMarkers(text: string): string {
  return text
    .replace(/\[\[LR\|[^\]]*\]\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}
