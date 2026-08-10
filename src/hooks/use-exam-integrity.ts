"use client";

import { useEffect, useRef, useState } from "react";
import {
  INTEGRITY_AWAY_MS,
  INTEGRITY_FLAG_AT,
  INTEGRITY_FORCE_SUBMIT_AT,
  emptyIntegrityState,
  type IntegrityEvent,
  type IntegrityState,
} from "@/lib/exam-integrity";

type UseExamIntegrityOptions = {
  enabled: boolean;
  sessionId: string | null;
  initial?: Partial<IntegrityState> | null;
  onPersist: (state: IntegrityState) => void;
  onForceSubmit: (state: IntegrityState) => void;
};

function isDocumentHidden() {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function hydrateFromInitial(
  initial?: Partial<IntegrityState> | null,
): IntegrityState {
  return {
    ...emptyIntegrityState(),
    ...initial,
    events: initial?.events ?? [],
    violationCount: initial?.violationCount ?? 0,
    flagged: Boolean(initial?.flagged),
    forcedSubmit: Boolean(initial?.forcedSubmit),
  };
}

export function useExamIntegrity({
  enabled,
  sessionId,
  initial,
  onPersist,
  onForceSubmit,
}: UseExamIntegrityOptions) {
  const [state, setState] = useState<IntegrityState>(() =>
    hydrateFromInitial(initial),
  );
  const [hydratedSessionId, setHydratedSessionId] = useState(sessionId);
  const [showReturnOverlay, setShowReturnOverlay] = useState(false);

  // Sync integrity snapshot when a (new) session id arrives — render-time adjust.
  if (sessionId !== hydratedSessionId) {
    setHydratedSessionId(sessionId);
    if (sessionId) {
      setState(hydrateFromInitial(initial));
      setShowReturnOverlay(false);
    }
  }

  const stateRef = useRef(state);
  const awayStartedAtRef = useRef<number | null>(null);
  const awayReasonRef = useRef<IntegrityEvent["type"] | null>(null);
  const forcedRef = useRef(false);
  const onPersistRef = useRef(onPersist);
  const onForceSubmitRef = useRef(onForceSubmit);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    onPersistRef.current = onPersist;
  }, [onPersist]);

  useEffect(() => {
    onForceSubmitRef.current = onForceSubmit;
  }, [onForceSubmit]);

  useEffect(() => {
    forcedRef.current = false;
    awayStartedAtRef.current = null;
    awayReasonRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    const markAway = (reason: IntegrityEvent["type"]) => {
      if (awayStartedAtRef.current != null) return;
      awayStartedAtRef.current = Date.now();
      awayReasonRef.current = reason;
    };

    const settleReturn = () => {
      const started = awayStartedAtRef.current;
      if (started == null) return;
      // Only settle once the tab is visible again (in-tab blur is ignored).
      if (isDocumentHidden()) return;

      const awayMs = Date.now() - started;
      awayStartedAtRef.current = null;
      const reason = awayReasonRef.current ?? "visibility_hidden";
      awayReasonRef.current = null;

      if (awayMs < INTEGRITY_AWAY_MS) return;

      setState((current) => {
        if (current.forcedSubmit || forcedRef.current) return current;

        const at = new Date().toISOString();
        const events: IntegrityEvent[] = [
          ...current.events,
          { type: reason, at, awayMs },
          { type: "return", at, awayMs },
        ];
        const violationCount = current.violationCount + 1;
        const flagged =
          current.flagged || violationCount >= INTEGRITY_FLAG_AT;
        const forcedSubmit = violationCount >= INTEGRITY_FORCE_SUBMIT_AT;
        const next: IntegrityState = {
          events,
          violationCount,
          flagged,
          forcedSubmit,
        };
        stateRef.current = next;
        onPersistRef.current(next);
        setShowReturnOverlay(true);

        if (forcedSubmit && !forcedRef.current) {
          forcedRef.current = true;
          onForceSubmitRef.current(next);
        }
        return next;
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // Leaving the tab / minimizing / switching apps (page hidden).
        markAway("visibility_hidden");
      } else {
        settleReturn();
      }
    };

    // Soft policy: in-tab focus loss and idle time (paper calculation) are
    // permitted. Only Page Visibility "hidden" counts as leaving the exam tab.
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, sessionId]);

  function dismissOverlay() {
    setShowReturnOverlay(false);
  }

  async function requestFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Best-effort; browsers may deny without gesture or policy.
    }
  }

  async function exitFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Best-effort; user may have already left fullscreen.
    }
  }

  return {
    integrity: state,
    showReturnOverlay,
    dismissOverlay,
    requestFullscreen,
    exitFullscreen,
    setIntegrity: setState,
  };
}
