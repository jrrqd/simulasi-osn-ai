"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

type Question = {
  id: string;
  prompt: string;
  answer: string;
  explanation: string;
};

async function saveProgress(body: {
  lessonId: string;
  checksPassed?: Record<string, boolean>;
  complete?: boolean;
}) {
  const res = await fetch("/api/lesson-progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Gagal menyimpan progress");
  return json.progress as {
    status: "in_progress" | "completed";
    checksPassed: Record<string, boolean>;
  };
}

export function LessonChecks({
  lessonId,
  questions,
  initialChecksPassed = {},
  initiallyCompleted = false,
}: {
  lessonId: string;
  questions: Question[];
  initialChecksPassed?: Record<string, boolean>;
  initiallyCompleted?: boolean;
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
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function persist(
    nextChecks: Record<string, boolean>,
    complete?: boolean,
  ) {
    setSaving(true);
    setError("");
    try {
      const progress = await saveProgress({
        lessonId,
        checksPassed: nextChecks,
        complete,
      });
      setChecksPassed(progress.checksPassed);
      if (progress.status === "completed") setCompleted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleCheck(q: Question) {
    const ok =
      (answers[q.id] ?? "").trim().toLowerCase() ===
      q.answer.trim().toLowerCase();
    setRevealed((r) => ({ ...r, [q.id]: true }));
    const next = { ...checksPassed, [q.id]: ok };
    setChecksPassed(next);
    await persist(next);
  }

  async function handleComplete() {
    await persist(checksPassed, true);
  }

  return (
    <div className="space-y-4">
      <div className="panel space-y-4 rounded-3xl p-6">
        <h2 className="display text-2xl">Cek konsep</h2>
        {questions.map((q) => {
          const show = revealed[q.id];
          const storedOk = checksPassed[q.id] === true;
          const typedOk =
            (answers[q.id] ?? "").trim().toLowerCase() ===
            q.answer.trim().toLowerCase();
          const ok = show ? typedOk : storedOk;
          return (
            <div
              key={q.id}
              className="space-y-2 border-b border-[var(--line)] pb-4 last:border-0 last:pb-0"
            >
              <p className="font-medium">{q.prompt}</p>
              <input
                className="input"
                value={answers[q.id] ?? ""}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                }
                disabled={saving}
              />
              <button
                className="btn btn-secondary !py-1.5"
                type="button"
                disabled={saving}
                onClick={() => void handleCheck(q)}
              >
                Cek
              </button>
              {(show || storedOk) && (
                <p className={ok ? "text-[var(--ok)]" : "text-[var(--bad)]"}>
                  {ok
                    ? "Benar. "
                    : show
                      ? `Kurang tepat (jawab: ${q.answer}). `
                      : ""}
                  {ok || show ? q.explanation : null}
                </p>
              )}
            </div>
          );
        })}
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
