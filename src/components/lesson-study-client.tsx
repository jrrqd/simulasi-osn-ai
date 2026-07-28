"use client";

import { useMemo, useState } from "react";
import {
  LessonChecks,
  LessonSideQuestLink,
} from "@/components/lesson-checks";
import type { CheckQuestion } from "@/lib/content/types";
import Link from "next/link";

type TocItem = { id: string; text: string; level: 2 | 3 };

export function LessonStudyClient({
  lessonId,
  track,
  topic,
  bodyHtmlIds,
  initialQuestions,
  initialChecksPassed,
  initiallyCompleted,
  initialSrs,
  dueQuestionIds,
  nextLessonId,
  nextLessonHref,
}: {
  lessonId: string;
  track: string;
  topic: string;
  bodyHtmlIds: TocItem[];
  initialQuestions: CheckQuestion[];
  initialChecksPassed: Record<string, boolean>;
  initiallyCompleted: boolean;
  initialSrs: Record<
    string,
    { questionId: string; wrongStreak: number; dueAt?: string }
  >;
  dueQuestionIds: string[];
  nextLessonId: string | null;
  nextLessonHref: string;
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  const passedCount = useMemo(
    () =>
      questions.filter((q) => initialChecksPassed[q.id] === true).length,
    [questions, initialChecksPassed],
  );

  async function generateChecks() {
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/ai/generate-lesson-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, count: 4 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal generate");
      setQuestions(data.allChecks ?? data.checks ?? questions);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full bg-white/70 px-3 py-1">
          Cek konsep: {passedCount}/{questions.length}
        </span>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full bg-[var(--accent)]"
            style={{
              width: `${questions.length ? (passedCount / questions.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {bodyHtmlIds.length > 0 ? (
        <nav className="panel rounded-3xl p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Daftar isi
          </p>
          <ul className="space-y-1 text-sm">
            {bodyHtmlIds.map((item) => (
              <li key={item.id} className={item.level === 3 ? "pl-3" : ""}>
                <a
                  href={`#${item.id}`}
                  className="text-[var(--accent)] hover:underline"
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <LessonChecks
        lessonId={lessonId}
        questions={questions}
        initialChecksPassed={initialChecksPassed}
        initiallyCompleted={initiallyCompleted}
        initialSrs={initialSrs}
        dueQuestionIds={dueQuestionIds}
        onGenerateChecks={() => void generateChecks()}
        generating={generating}
      />
      {genError ? (
        <p className="text-sm text-[var(--bad)]">{genError}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <LessonSideQuestLink track={track} topic={topic} />
        {nextLessonId ? (
          <Link href={nextLessonHref} className="btn btn-primary">
            Level berikutnya
          </Link>
        ) : (
          <Link href="/study" className="btn btn-primary">
            Kembali ke checklist
          </Link>
        )}
      </div>
    </div>
  );
}

/** Extract h2/h3 headings from markdown body for TOC. */
export function extractMarkdownToc(body: string): TocItem[] {
  const items: TocItem[] = [];
  for (const line of body.split("\n")) {
    const m = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    const level = m[1]!.length === 2 ? 2 : 3;
    const text = m[2]!.replace(/[#*`]/g, "").trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (text && id) items.push({ id, text, level });
  }
  return items;
}
