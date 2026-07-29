/**
 * ICPC-style submission penalty for timed mocks (tie-breaker).
 * Primary score remains weighted correctness; penaltyMinutes ranks ties
 * (lower is better among equal primary scores).
 */

export const DEFAULT_PENALTY_MINUTES_PER_WRONG = 1;

export type ProblemPenaltyState = {
  attempts: number;
  wrongCount: number;
  wrongAt: string[];
  lockedAt?: string;
  solved: boolean;
  /** Penalty minutes attributable to this problem (only if solved). */
  penaltyMin: number;
};

export type SessionPenaltyState = Record<string, ProblemPenaltyState>;

export type ScoreboardRow = {
  problemId: string;
  attempts: number;
  wrongCount: number;
  solved: boolean;
  penaltyMin: number;
  lockedAt?: string;
};

export function emptyProblemPenalty(): ProblemPenaltyState {
  return {
    attempts: 0,
    wrongCount: 0,
    wrongAt: [],
    solved: false,
    penaltyMin: 0,
  };
}

export function normalizePenaltyState(raw: unknown): SessionPenaltyState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SessionPenaltyState = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const row = v as Record<string, unknown>;
    out[id] = {
      attempts: Number(row.attempts) || 0,
      wrongCount: Number(row.wrongCount) || 0,
      wrongAt: Array.isArray(row.wrongAt) ? row.wrongAt.map(String) : [],
      lockedAt: row.lockedAt ? String(row.lockedAt) : undefined,
      solved: row.solved === true,
      penaltyMin: Number(row.penaltyMin) || 0,
    };
  }
  return out;
}

/**
 * Record one graded submit for a problem.
 * If already locked/solved, no-op (returns previous state).
 */
export function recordSubmission(params: {
  state: SessionPenaltyState;
  problemId: string;
  isCorrect: boolean;
  /** Minutes since exam start at this submit. */
  minutesFromStart: number;
  penaltyMinutesPerWrong?: number;
  now?: Date;
}): {
  state: SessionPenaltyState;
  problem: ProblemPenaltyState;
  changed: boolean;
  kind: "submit" | "lock";
} {
  const perWrong =
    params.penaltyMinutesPerWrong ?? DEFAULT_PENALTY_MINUTES_PER_WRONG;
  const now = params.now ?? new Date();
  const prev = params.state[params.problemId] ?? emptyProblemPenalty();
  if (prev.solved || prev.lockedAt) {
    return {
      state: params.state,
      problem: prev,
      changed: false,
      kind: "lock",
    };
  }

  const next: ProblemPenaltyState = {
    ...prev,
    attempts: prev.attempts + 1,
    wrongAt: [...prev.wrongAt],
  };

  let kind: "submit" | "lock" = "submit";
  if (params.isCorrect) {
    next.solved = true;
    next.lockedAt = now.toISOString();
    next.penaltyMin =
      next.wrongCount * perWrong + Math.max(0, Math.floor(params.minutesFromStart));
    kind = "lock";
  } else {
    next.wrongCount += 1;
    next.wrongAt.push(now.toISOString());
    next.penaltyMin = 0; // only counts when solved
  }

  return {
    state: { ...params.state, [params.problemId]: next },
    problem: next,
    changed: true,
    kind,
  };
}

export function getScoreboard(state: SessionPenaltyState): ScoreboardRow[] {
  return Object.entries(state).map(([problemId, row]) => ({
    problemId,
    attempts: row.attempts,
    wrongCount: row.wrongCount,
    solved: row.solved,
    penaltyMin: row.solved ? row.penaltyMin : 0,
    lockedAt: row.lockedAt,
  }));
}

export function totalPenaltyMinutes(state: SessionPenaltyState): number {
  return getScoreboard(state).reduce((s, r) => s + r.penaltyMin, 0);
}

export function totalAttempts(state: SessionPenaltyState): number {
  return Object.values(state).reduce((s, r) => s + r.attempts, 0);
}

export function formatPenaltySummary(state: SessionPenaltyState): {
  solvedCount: number;
  totalAttempts: number;
  penaltyMinutes: number;
  rows: ScoreboardRow[];
} {
  const rows = getScoreboard(state);
  return {
    solvedCount: rows.filter((r) => r.solved).length,
    totalAttempts: totalAttempts(state),
    penaltyMinutes: totalPenaltyMinutes(state),
    rows,
  };
}
