"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { CheckQuestion } from "@/lib/content/types";
import { NumericInput } from "@/components/numeric-input";
import { scoreCheckQuestion } from "@/lib/scoring";

type SrsSnapshot = {
  questionId: string;
  wrongStreak: number;
  dueAt?: string;
};

async function saveProgress(body: {
  lessonId: string;
  checksPassed?: Record<string, boolean>;
  complete?: boolean;
  checkResult?: { questionId: string; correct: boolean };
}) {
  const res = await fetch("/api/lesson-progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Gagal menyimpan progress");
  return json as {
    progress: {
      status: "in_progress" | "completed";
      checksPassed: Record<string, boolean>;
    };
    srs?: SrsSnapshot;
  };
}

export function LessonChecks({
  lessonId,
  questions,
  initialChecksPassed = {},
  initiallyCompleted = false,
  initialSrs = {},
  dueQuestionIds = [],
  onGenerateChecks,
  generating = false,
}: {
  lessonId: string;
  questions: CheckQuestion[];
  initialChecksPassed?: Record<string, boolean>;
  initiallyCompleted?: boolean;
  initialSrs?: Record<string, SrsSnapshot>;
  dueQuestionIds?: string[];
  onGenerateChecks?: () => void;
  generating?: boolean;
}) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const [id, ok] of Object.entries(initialChecksPassed)) {
      if (ok) init[id] = true;
    }
    return init;
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checksPassed, setChecksPassed] =
    useState<Record<string, boolean>>(initialChecksPassed);
  const [wrongStreak, setWrongStreak] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const [id, s] of Object.entries(initialSrs)) {
      init[id] = s.wrongStreak ?? 0;
    }
    return init;
  });
  const [formatHints, setFormatHints] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [reviewOnlyDue, setReviewOnlyDue] = useState(dueQuestionIds.length > 0);
  const [dismissedDueBanner, setDismissedDueBanner] = useState(false);

  const visibleQuestions = useMemo(() => {
    if (!reviewOnlyDue || dueQuestionIds.length === 0) return questions;
    const dueSet = new Set(dueQuestionIds);
    const due = questions.filter((q) => dueSet.has(q.id));
    return due.length > 0 ? due : questions;
  }, [questions, reviewOnlyDue, dueQuestionIds]);

  const passedCount = useMemo(
    () => questions.filter((q) => checksPassed[q.id]).length,
    [questions, checksPassed],
  );

  async function persist(
    nextChecks: Record<string, boolean>,
    complete?: boolean,
    checkResult?: { questionId: string; correct: boolean },
  ) {
    setSaving(true);
    setError("");
    try {
      const data = await saveProgress({
        lessonId,
        checksPassed: nextChecks,
        complete,
        checkResult,
      });
      setChecksPassed(data.progress.checksPassed);
      if (data.progress.status === "completed") setCompleted(true);
      if (data.srs && checkResult) {
        setWrongStreak((w) => ({
          ...w,
          [data.srs!.questionId]: data.srs!.wrongStreak,
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleCheck(q: CheckQuestion) {
    const submitted = answers[q.id] ?? "";
    const result = scoreCheckQuestion(q, submitted);
    setRevealed((r) => ({ ...r, [q.id]: true }));
    if (result.formatHint) {
      setFormatHints((h) => ({ ...h, [q.id]: result.formatHint! }));
    } else {
      setFormatHints((h) => {
        const next = { ...h };
        delete next[q.id];
        return next;
      });
    }
    const next = { ...checksPassed, [q.id]: result.correct };
    setChecksPassed(next);
    if (!result.correct) {
      setWrongStreak((w) => ({ ...w, [q.id]: (w[q.id] ?? 0) + 1 }));
    } else {
      setWrongStreak((w) => ({ ...w, [q.id]: 0 }));
    }
    await persist(next, undefined, {
      questionId: q.id,
      correct: result.correct,
    });
  }

  async function handleCheckAll() {
    for (const q of visibleQuestions) {
      await handleCheck(q);
    }
  }

  async function handleComplete() {
    await persist(checksPassed, true);
  }

  if (questions.length === 0) {
    return (
      <div className="panel space-y-4 rounded-3xl p-6">
        <h2 className="display text-2xl">Cek konsep</h2>
        <p className="text-sm text-[var(--muted)]">
          Belum ada cek konsep untuk modul ini.
        </p>
        {onGenerateChecks ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={generating}
            onClick={onGenerateChecks}
          >
            {generating ? "Menghasilkan…" : "Generate cek konsep via AI"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!dismissedDueBanner && dueQuestionIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgba(196,92,38,0.35)] bg-[rgba(196,92,38,0.08)] px-4 py-3 text-sm">
          <p>
            <strong>{dueQuestionIds.length} soal</strong> perlu diulang
            (spaced repetition).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary !py-1.5"
              onClick={() => {
                setReviewOnlyDue(true);
                setDismissedDueBanner(true);
              }}
            >
              Ulang sekarang
            </button>
            <button
              type="button"
              className="btn btn-secondary !py-1.5"
              onClick={() => {
                setReviewOnlyDue(false);
                setDismissedDueBanner(true);
              }}
            >
              Lewati
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel space-y-4 rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="display text-2xl">Cek konsep</h2>
            <p className="text-sm text-[var(--muted)]">
              {passedCount}/{questions.length} benar · active recall multi-format
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn !py-1.5 ${batchMode ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setBatchMode((v) => !v)}
            >
              {batchMode ? "Mode: cek semua" : "Mode: satu-satu"}
            </button>
            {onGenerateChecks ? (
              <button
                type="button"
                className="btn btn-secondary !py-1.5"
                disabled={generating || saving}
                onClick={onGenerateChecks}
              >
                {generating ? "Generating…" : "Tambah cek konsep AI"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full bg-[var(--accent)]"
            style={{
              width: `${questions.length ? (passedCount / questions.length) * 100 : 0}%`,
            }}
          />
        </div>

        {visibleQuestions.map((q) => {
          const show = revealed[q.id];
          const storedOk = checksPassed[q.id] === true;
          const result = show
            ? scoreCheckQuestion(q, answers[q.id] ?? "")
            : null;
          const ok = show ? Boolean(result?.correct) : storedOk;
          const streak = wrongStreak[q.id] ?? 0;
          const hintIndex = Math.min(streak, q.hints?.length ?? 0) - 1;
          const hint =
            !ok && streak >= 1 && q.hints && hintIndex >= 0
              ? q.hints[hintIndex]
              : null;

          return (
            <div
              key={q.id}
              className="space-y-2 border-b border-[var(--line)] pb-4 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{q.prompt}</p>
                <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  {q.answerType}
                  {q.difficulty ? ` · L${q.difficulty}` : ""}
                </span>
              </div>

              {q.answerType === "mcq" && q.choices?.length ? (
                <div className="space-y-2">
                  {q.choices.map((c) => (
                    <label
                      key={c}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/60 px-3 py-2"
                    >
                      <input
                        type="radio"
                        name={`check-${q.id}`}
                        checked={(answers[q.id] ?? "") === c}
                        disabled={saving}
                        onChange={() =>
                          setAnswers((a) => ({ ...a, [q.id]: c }))
                        }
                      />
                      <span>{c}</span>
                    </label>
                  ))}
                </div>
              ) : q.answerType === "numeric" ? (
                <NumericInput
                  value={answers[q.id] ?? ""}
                  disabled={saving}
                  numericFormat={q.numericFormat}
                  onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                />
              ) : (
                <input
                  className="input"
                  value={answers[q.id] ?? ""}
                  disabled={saving}
                  placeholder="Jawaban singkat"
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                  }
                />
              )}

              {!batchMode ? (
                <button
                  className="btn btn-secondary !py-1.5"
                  type="button"
                  disabled={saving}
                  onClick={() => void handleCheck(q)}
                >
                  Cek
                </button>
              ) : null}

              {(show || storedOk) && (
                <div className="space-y-1 text-sm">
                  <p className={ok ? "text-[var(--ok)]" : "text-[var(--bad)]"}>
                    {ok
                      ? "Benar. "
                      : show
                        ? `Kurang tepat (kunci: ${String(q.answer)}). `
                        : ""}
                    {ok || show ? q.explanation : null}
                  </p>
                  {formatHints[q.id] ? (
                    <p className="text-[var(--bad)]">{formatHints[q.id]}</p>
                  ) : null}
                  {!ok && q.conceptTags && q.conceptTags.length > 0 ? (
                    <p className="text-[var(--muted)]">
                      Konsep terkait:{" "}
                      {q.conceptTags.map((tag) => (
                        <a
                          key={tag}
                          href={`#concept-${slugify(tag)}`}
                          className="mr-2 text-[var(--accent)] underline-offset-2 hover:underline"
                        >
                          {tag}
                        </a>
                      ))}
                    </p>
                  ) : null}
                  {hint ? (
                    <p className="rounded-xl bg-black/[0.04] px-3 py-2 text-[var(--muted)]">
                      Hint {hintIndex + 1}: {hint}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}

        {batchMode ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() => void handleCheckAll()}
          >
            {saving ? "Menilai…" : "Cek semua jawaban"}
          </button>
        ) : null}
      </div>

      <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5">
        <div>
          <p className="text-sm font-medium">
            {completed ? "Level selesai" : "Selesaikan level tutorial"}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {completed
              ? "Checklist sudah dicentang. Lanjut side quest jika mau."
              : "Tandai selesai setelah baca, atau jawab semua cek konsep dengan benar."}
          </p>
          {error ? <p className="mt-1 text-sm text-[var(--bad)]">{error}</p> : null}
        </div>
        {completed ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(31,122,76,0.14)] px-3 py-1.5 text-sm font-medium text-[var(--ok)]">
            <Check size={14} strokeWidth={2.5} aria-hidden />
            Selesai
          </span>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() => void handleComplete()}
          >
            {saving ? "Menyimpan…" : "Selesai level"}
          </button>
        )}
      </div>
    </div>
  );
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function LessonSideQuestLink({
  track,
  topic,
}: {
  track: string;
  topic: string;
}) {
  return (
    <Link
      href={`/practice?track=${encodeURIComponent(track)}&topic=${encodeURIComponent(topic)}`}
      className="btn btn-secondary"
    >
      Side quests topik ini
    </Link>
  );
}
