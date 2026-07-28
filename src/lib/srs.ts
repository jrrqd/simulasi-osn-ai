/**
 * SM-2 lite spaced repetition for lesson check-questions.
 * Interval in days; ease starts at 2.5.
 */

export type SrsState = {
  ease: number;
  intervalDays: number;
  correctCount: number;
  wrongStreak: number;
  dueAt: Date;
  lastSeenAt: Date;
};

export type SrsUpdate = SrsState & {
  /** Quality 0–5 style: we map boolean → 2 (wrong) / 4 (correct). */
  quality: number;
};

const MIN_EASE = 1.3;

export function defaultSrsState(now = new Date()): SrsState {
  return {
    ease: 2.5,
    intervalDays: 0,
    correctCount: 0,
    wrongStreak: 0,
    dueAt: now,
    lastSeenAt: now,
  };
}

/** Apply one review outcome and return next SRS state. */
export function applySrsReview(
  prev: SrsState | null | undefined,
  correct: boolean,
  now = new Date(),
): SrsUpdate {
  const base = prev ?? defaultSrsState(now);
  const quality = correct ? 4 : 2;

  let ease =
    base.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease < MIN_EASE) ease = MIN_EASE;

  let intervalDays: number;
  let correctCount = base.correctCount;
  let wrongStreak = base.wrongStreak;

  if (!correct) {
    intervalDays = 0; // due immediately / next session
    wrongStreak = base.wrongStreak + 1;
  } else {
    wrongStreak = 0;
    correctCount = base.correctCount + 1;
    if (base.intervalDays <= 0) intervalDays = 1;
    else if (base.intervalDays === 1) intervalDays = 3;
    else intervalDays = Math.round(base.intervalDays * ease * 10) / 10;
  }

  const dueAt = new Date(
    now.getTime() + Math.max(0, intervalDays) * 24 * 60 * 60 * 1000,
  );

  return {
    ease,
    intervalDays,
    correctCount,
    wrongStreak,
    dueAt,
    lastSeenAt: now,
    quality,
  };
}

export function isDue(state: SrsState | null | undefined, now = new Date()) {
  if (!state) return true; // never seen → due
  return state.dueAt.getTime() <= now.getTime();
}
