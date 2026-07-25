import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getLesson, getLessons } from "@/lib/content/load";
import { TOPIC_LABELS } from "@/lib/content/types";
import { getUserLessonProgress } from "@/lib/lesson-progress";
import { Markdown } from "@/components/markdown";
import {
  LessonChecks,
  LessonSideQuestLink,
} from "@/components/lesson-checks";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) notFound();

  const trackLessons = getLessons().filter((l) => l.track === lesson.track);
  const levelIndex = trackLessons.findIndex((l) => l.id === lesson.id);
  const levelNumber = levelIndex >= 0 ? levelIndex + 1 : 1;
  const nextLesson =
    levelIndex >= 0 && levelIndex < trackLessons.length - 1
      ? trackLessons[levelIndex + 1]
      : null;

  const progressMap = await getUserLessonProgress(user.id);
  const progress = progressMap.get(lesson.id);
  const completed = progress?.status === "completed";

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-[var(--muted)]">
          Tutorial · Track {lesson.track} · Level {levelNumber}
          {" · "}
          {TOPIC_LABELS[lesson.topic] ?? lesson.topic}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="display text-4xl">{lesson.title}</h1>
          {completed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(31,122,76,0.14)] px-2.5 py-1 text-xs font-medium text-[var(--ok)]">
              <Check size={12} strokeWidth={2.5} aria-hidden />
              Selesai
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-[var(--muted)]">{lesson.summary}</p>
      </div>
      <div className="panel rounded-3xl p-6">
        <Markdown content={lesson.body} />
      </div>
      <LessonChecks
        lessonId={lesson.id}
        questions={lesson.checkQuestions}
        initialChecksPassed={progress?.checksPassed ?? {}}
        initiallyCompleted={completed}
      />
      <div className="flex flex-wrap gap-2">
        <LessonSideQuestLink track={lesson.track} topic={lesson.topic} />
        {nextLesson ? (
          <Link href={`/study/${nextLesson.id}`} className="btn btn-primary">
            Level berikutnya
          </Link>
        ) : (
          <Link href="/study" className="btn btn-primary">
            Kembali ke checklist
          </Link>
        )}
      </div>
    </article>
  );
}
