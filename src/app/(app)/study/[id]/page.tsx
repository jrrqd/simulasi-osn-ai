import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getLesson } from "@/lib/content/load";
import { Markdown } from "@/components/markdown";
import { LessonChecks } from "@/components/lesson-checks";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) notFound();

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-[var(--muted)]">
          Track {lesson.track} · {lesson.topic}
        </p>
        <h1 className="display text-4xl">{lesson.title}</h1>
        <p className="mt-2 text-[var(--muted)]">{lesson.summary}</p>
      </div>
      <div className="panel rounded-3xl p-6">
        <Markdown content={lesson.body} />
      </div>
      <LessonChecks questions={lesson.checkQuestions} />
    </article>
  );
}
