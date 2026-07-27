export const INTEGRITY_AWAY_MS = 1_500;
export const INTEGRITY_FLAG_AT = 3;
export const INTEGRITY_FORCE_SUBMIT_AT = 5;
export const INTEGRITY_EVENTS_CAP = 100;

export type IntegrityEventType =
  | "visibility_hidden"
  | "blur"
  | "fullscreen_exit"
  | "return"
  | "forced_submit";

export type IntegrityEvent = {
  type: IntegrityEventType;
  at: string;
  awayMs?: number;
  detail?: string;
};

export type IntegrityState = {
  events: IntegrityEvent[];
  violationCount: number;
  flagged: boolean;
  forcedSubmit: boolean;
};

export function emptyIntegrityState(): IntegrityState {
  return {
    events: [],
    violationCount: 0,
    flagged: false,
    forcedSubmit: false,
  };
}

export function normalizeIntegrityEvents(value: unknown): IntegrityEvent[] {
  if (!Array.isArray(value)) return [];
  const events: IntegrityEvent[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const type = String(row.type ?? "");
    const at = String(row.at ?? "");
    if (!type || !at) continue;
    events.push({
      type: type as IntegrityEventType,
      at,
      awayMs: typeof row.awayMs === "number" ? row.awayMs : undefined,
      detail: typeof row.detail === "string" ? row.detail : undefined,
    });
  }
  return events;
}

/** Merge client integrity update into stored session (monotonic only). */
export function mergeIntegrityUpdate(
  stored: IntegrityState,
  incoming: {
    events?: unknown;
    violationCount?: unknown;
    flagged?: unknown;
    forcedSubmit?: unknown;
  },
): IntegrityState {
  const incomingEvents = normalizeIntegrityEvents(incoming.events);
  const mergedEvents = [...stored.events];
  const seen = new Set(
    stored.events.map((e) => `${e.type}|${e.at}|${e.awayMs ?? ""}`),
  );
  for (const event of incomingEvents) {
    const key = `${event.type}|${event.at}|${event.awayMs ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    mergedEvents.push(event);
  }
  const capped =
    mergedEvents.length > INTEGRITY_EVENTS_CAP
      ? mergedEvents.slice(-INTEGRITY_EVENTS_CAP)
      : mergedEvents;

  const incomingCount =
    typeof incoming.violationCount === "number" &&
    Number.isFinite(incoming.violationCount)
      ? Math.max(0, Math.floor(incoming.violationCount))
      : stored.violationCount;
  const violationCount = Math.max(stored.violationCount, incomingCount);
  const flagged =
    stored.flagged ||
    incoming.flagged === true ||
    violationCount >= INTEGRITY_FLAG_AT;
  const forcedSubmit =
    stored.forcedSubmit ||
    incoming.forcedSubmit === true ||
    violationCount >= INTEGRITY_FORCE_SUBMIT_AT;

  return {
    events: capped,
    violationCount,
    flagged,
    forcedSubmit,
  };
}

export function integritySummary(state: IntegrityState) {
  return {
    violationCount: state.violationCount,
    flagged: state.flagged,
    forcedSubmit: state.forcedSubmit,
    events: state.events.slice(-40),
  };
}
