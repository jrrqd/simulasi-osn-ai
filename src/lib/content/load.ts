import lessonsData from "../../../content/lessons/index.json";
import problemsData from "../../../content/problems/index.json";
import mocksData from "../../../content/mocks/index.json";
import type {
  CheckQuestion,
  CheckQuestionAnswerType,
  Lesson,
  MockExam,
  Problem,
} from "@/lib/content/types";
import { inferNumericPartCount } from "@/lib/content/types";

function isLegacyProblem(p: Problem): boolean {
  if (p.legacy === true) return true;
  if (p.legacy === false) return false;
  // Curated bank without OSN-2026 fields → legacy scoring path
  const hasNewFields =
    Boolean(p.numericFormat || p.expectedFormat) ||
    Boolean(p.codeSpec) ||
    Boolean(p.competitionSpec) ||
    p.answerType === "notebook_submission" ||
    (typeof p.weight === "number" && Number.isFinite(p.weight));
  return !hasNewFields;
}

export function normalizeProblem(raw: Problem): Problem {
  const numericFormat = raw.numericFormat ?? raw.expectedFormat;
  const numericPartCount =
    raw.numericPartCount ??
    inferNumericPartCount(numericFormat, raw.answer);
  const legacy = isLegacyProblem({
    ...raw,
    numericFormat,
  });
  return {
    ...raw,
    source: raw.source ?? "curated",
    numericFormat,
    expectedFormat: raw.expectedFormat ?? numericFormat,
    numericPartCount,
    legacy,
  };
}

/** Migrate legacy free-text checkQuestions → typed CheckQuestion. */
export function normalizeCheckQuestion(raw: unknown): CheckQuestion | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const q = raw as Record<string, unknown>;
  const id = String(q.id ?? "").trim();
  const prompt = String(q.prompt ?? "").trim();
  const explanation = String(q.explanation ?? "").trim();
  if (!id || !prompt) return null;

  const rawType = String(q.answerType ?? "")
    .trim()
    .toLowerCase();
  const answerType: CheckQuestionAnswerType =
    rawType === "numeric" || rawType === "mcq" || rawType === "short_string"
      ? rawType
      : "short_string";

  const answer: string | number | string[] = Array.isArray(q.answer)
    ? q.answer.map(String)
    : typeof q.answer === "number"
      ? q.answer
      : String(q.answer ?? "");

  const choices = Array.isArray(q.choices)
    ? q.choices.map(String)
    : undefined;

  const difficultyRaw = Number(q.difficulty);
  const difficulty =
    difficultyRaw === 1 || difficultyRaw === 2 || difficultyRaw === 3
      ? (difficultyRaw as 1 | 2 | 3)
      : undefined;

  const conceptTags = Array.isArray(q.conceptTags)
    ? q.conceptTags.map(String).filter(Boolean)
    : undefined;
  const hints = Array.isArray(q.hints)
    ? q.hints.map(String).filter(Boolean)
    : undefined;

  const nf = String(q.numericFormat ?? "");
  const numericFormat =
    nf === "integer" ||
    nf === "decimal" ||
    nf === "space_separated" ||
    nf === "comma_separated"
      ? nf
      : undefined;

  const sourceRaw = String(q.source ?? "curated");
  const source =
    sourceRaw === "ai" || sourceRaw === "admin" || sourceRaw === "curated"
      ? sourceRaw
      : "curated";

  return {
    id,
    prompt,
    answerType,
    answer,
    choices,
    tolerance:
      typeof q.tolerance === "number" && Number.isFinite(q.tolerance)
        ? q.tolerance
        : undefined,
    numericFormat,
    explanation,
    difficulty,
    conceptTags,
    hints,
    hidden: q.hidden === true,
    source,
  };
}

export function normalizeLesson(raw: Lesson): Lesson {
  const checks: CheckQuestion[] = [];
  for (const rawQ of raw.checkQuestions ?? []) {
    const q = normalizeCheckQuestion(rawQ);
    if (q && !q.hidden) checks.push(q);
  }
  return { ...raw, checkQuestions: checks };
}

export function getLessons(): Lesson[] {
  return (lessonsData as Lesson[]).map(normalizeLesson);
}

export function getLesson(id: string) {
  return getLessons().find((l) => l.id === id);
}

export function getLessonsForTopic(track: string, topic: string): Lesson[] {
  return getLessons().filter((l) => l.track === track && l.topic === topic);
}

export function getProblems(): Problem[] {
  return (problemsData as Problem[]).map((p) =>
    normalizeProblem({ ...p, source: p.source ?? "curated" }),
  );
}

export function getProblem(id: string) {
  return getProblems().find((p) => p.id === id);
}

export function getMocks(): MockExam[] {
  return mocksData as MockExam[];
}

export function getMock(id: string) {
  return getMocks().find((m) => m.id === id);
}

export function getProblemsForMock(mockId: string) {
  const mock = getMock(mockId);
  if (!mock) return [];
  return mock.problemIds
    .map((id) => getProblem(id))
    .filter(Boolean) as Problem[];
}
