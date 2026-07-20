import lessonsData from "../../../content/lessons/index.json";
import problemsData from "../../../content/problems/index.json";
import mocksData from "../../../content/mocks/index.json";
import type { Lesson, MockExam, Problem } from "@/lib/content/types";

export function getLessons(): Lesson[] {
  return lessonsData as Lesson[];
}

export function getLesson(id: string) {
  return getLessons().find((l) => l.id === id);
}

export function getLessonsForTopic(track: string, topic: string): Lesson[] {
  return getLessons().filter((l) => l.track === track && l.topic === topic);
}

export function getProblems(): Problem[] {
  return (problemsData as Problem[]).map((p) => ({
    ...p,
    source: p.source ?? "curated",
  }));
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
