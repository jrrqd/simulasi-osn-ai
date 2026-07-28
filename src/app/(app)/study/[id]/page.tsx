import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getLesson, getLessons } from "@/lib/content/load";
import { TOPIC_LABELS } from "@/lib/content/types";
import { getUserLessonProgress } from "@/lib/lesson-progress";
import { Markdown } from "@/components/markdown";
import {
  extractMarkdownToc,
  LessonStudyClient,
} from "@/components/lesson-study-client";
import {
  dueQuestionIds,
  getLessonCheckQuestions,
  getUserCheckAttempts,
} from "@/lib/lesson-checks";

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

  const questions = await getLessonCheckQuestions(lesson.id);
  const srsMap = await getUserCheckAttempts(user.id, lesson.id);
  const dueIds = dueQuestionIds(
    srsMap,
    questions.map((q) => q.id),
  );
  const initialSrs = Object.fromEntries(
    [...srsMap.entries()].map(([qid, row]) => [
      qid,
      {
        questionId: qid,
        wrongStreak: row.wrongStreak,
        dueAt: row.dueAt.toISOString(),
      },
    ]),
  );

  const toc = extractMarkdownToc(lesson.body);

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
      <LessonStudyClient
        lessonId={lesson.id}
        track={lesson.track}
        topic={lesson.topic}
        bodyHtmlIds={toc}
        initialQuestions={questions}
        initialChecksPassed={progress?.checksPassed ?? {}}
        initiallyCompleted={completed}
        initialSrs={initialSrs}
        dueQuestionIds={dueIds}
        nextLessonId={nextLesson?.id ?? null}
        nextLessonHref={nextLesson ? `/study/${nextLesson.id}` : "/study"}
      />
    </article>
  );
}
