import type { ExamFormat } from "@/lib/content/types";
import type { Phase } from "@/lib/user/phase";

/**
 * pre-seleksi practice mocks use soft browser integrity (fullscreen + tab leave).
 * semifinal/final and kaggle competitions follow live proctoring rules instead
 * (Zoom + screen record) — no fullscreen lockdown or auto force-submit.
 */
export type ExamIntegrityMode = "strict" | "off";

export function resolveExamIntegrityMode(params: {
  userPhase: Phase;
  examFormat?: ExamFormat | string | null;
}): ExamIntegrityMode {
  if (params.examFormat === "kaggle") return "off";
  if (params.userPhase === "semifinal" || params.userPhase === "final") {
    return "off";
  }
  return "strict";
}
