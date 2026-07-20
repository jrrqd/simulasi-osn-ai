"use client";

import { useState } from "react";

export function LessonChecks({
  questions,
}: {
  questions: { id: string; prompt: string; answer: string; explanation: string }[];
}) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});

  return (
    <div className="panel space-y-4 rounded-3xl p-6">
      <h2 className="display text-2xl">Cek konsep</h2>
      {questions.map((q) => {
        const show = revealed[q.id];
        const ok =
          (answers[q.id] ?? "").trim().toLowerCase() ===
          q.answer.trim().toLowerCase();
        return (
          <div key={q.id} className="space-y-2 border-b border-[var(--line)] pb-4">
            <p className="font-medium">{q.prompt}</p>
            <input
              className="input"
              value={answers[q.id] ?? ""}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
              }
            />
            <button
              className="btn btn-secondary !py-1.5"
              type="button"
              onClick={() => setRevealed((r) => ({ ...r, [q.id]: true }))}
            >
              Cek
            </button>
            {show && (
              <p className={ok ? "text-[var(--ok)]" : "text-[var(--bad)]"}>
                {ok ? "Benar. " : `Kurang tepat (jawab: ${q.answer}). `}
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
