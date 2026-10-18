import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getLesson, getLessons } from "@/lib/content/load";
import { TOPIC_LABELS } from "@/lib/content/types";
import { getUserLessonProgress } from "@/lib/lesson-progress";
import { Markdown } from "@/components/markdown";
import { extractMarkdownToc } from "@/lib/lesson-toc";
import { LessonStudyClient } from "@/components/lesson-study-client";
import { IoaiResourcesPanel } from "@/components/ioai-resources-panel";
import { loadUserPhase } from "@/lib/user/load-phase";
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
  const prevLesson = levelIndex > 0 ? trackLessons[levelIndex - 1] : null;

  const [phase, progressMap, questions, srsMap] = await Promise.all([
    loadUserPhase(user.id),
    getUserLessonProgress(user.id),
    getLessonCheckQuestions(lesson.id),
    getUserCheckAttempts(user.id, lesson.id),
  ]);
  const progress = progressMap.get(lesson.id);
  const completed = progress?.status === "completed";
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
        initialQuestions={questions.map(
          ({ answer: _answer, explanation: _explanation, ...question }) =>
            question,
        )}
        initialChecksPassed={progress?.checksPassed ?? {}}
        initiallyCompleted={completed}
        initialSrs={initialSrs}
        dueQuestionIds={dueIds}
        nextLessonId={nextLesson?.id ?? null}
        nextLessonHref={nextLesson ? `/study/${nextLesson.id}` : "/study"}
      />
      <IoaiResourcesPanel
        phase={phase}
        track={lesson.track}
        topic={lesson.topic}
      />

      <div className="panel space-y-4 rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Latihan side quest
            </p>
            <p className="text-sm text-[var(--muted)]">
              Cek pemahaman topik ini di bank soal.
            </p>
          </div>
          <Link
            href={`/practice?track=${encodeURIComponent(lesson.track)}&topic=${encodeURIComponent(lesson.topic)}`}
            className="btn btn-secondary !py-1.5 text-sm"
          >
            Latihan topik ini
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {prevLesson ? (
            <Link
              href={`/study/${prevLesson.id}`}
              className="flex items-start gap-2 rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 hover:bg-white"
            >
              <ChevronLeft
                size={18}
                className="mt-0.5 shrink-0 text-[var(--muted)]"
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-xs text-[var(--muted)]">
                  Modul sebelumnya
                </span>
                <span className="font-medium leading-snug">
                  {prevLesson.title}
                </span>
              </span>
            </Link>
          ) : (
            <div />
          )}
          {nextLesson ? (
            <Link
              href={`/study/${nextLesson.id}`}
              className="flex items-start justify-end gap-2 rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 text-right hover:bg-white sm:ml-auto"
            >
              <span className="min-w-0">
                <span className="block text-xs text-[var(--muted)]">
                  Modul berikutnya
                </span>
                <span className="font-medium leading-snug">
                  {nextLesson.title}
                </span>
              </span>
              <ChevronRight
                size={18}
                className="mt-0.5 shrink-0 text-[var(--muted)]"
                aria-hidden
              />
            </Link>
          ) : (
            <Link
              href="/study"
              className="flex items-center justify-end gap-2 rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 text-sm hover:bg-white"
            >
              Kembali ke daftar tutorial
              <ChevronRight size={16} aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
