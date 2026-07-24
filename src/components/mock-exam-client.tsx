"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { Markdown } from "@/components/markdown";
import {
  TOPIC_LABELS,
  TRACKS,
  type Problem,
} from "@/lib/content/types";

type Result = {
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  elapsedMs: number;
  byTrack: Record<string, { score: number; maxScore: number }>;
  byTopic: Record<string, { score: number; maxScore: number }>;
  breakdown: Record<
    string,
    {
      correct: boolean;
      score: number;
      expected: unknown;
      submitted: unknown;
      track: string;
      topic: string;
    }
  >;
};

function formatDuration(ms: number) {
  const totalMinutes = Math.round(ms / 60_000);
  return `${Math.floor(totalMinutes / 60)} jam ${totalMinutes % 60} menit`;
}

export function MockExamClient({
  mockId,
  title,
  durationMinutes,
  problems,
}: {
  mockId: string;
  title: string;
  durationMinutes: number;
  problems: Problem[];
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setTimeout(() => {
      fetch("/api/mocks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, answers }),
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [answers, sessionId]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (sessionId && !result) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [result, sessionId]);

  const answeredCount = useMemo(
    () =>
      problems.reduce(
        (count, problem) =>
          answers[problem.id]?.trim() ? count + 1 : count,
        0,
      ),
    [answers, problems],
  );

  async function start() {
    setStarting(true);
    setError("");
    const response = await fetch("/api/mocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mockId }),
    });
    const data = await response.json();
    setStarting(false);
    if (!response.ok) {
      setError(data.error || "Gagal memulai simulasi");
      return;
    }
    setSessionId(data.sessionId);
    setEndsAt(data.endsAt);
    setAnswers(data.answers ?? {});
  }

  async function submit(force = false) {
    if (!sessionId || submitting) return;
    const unanswered = problems.length - answeredCount;
    if (
      !force &&
      !window.confirm(
        unanswered
          ? `Masih ada ${unanswered} soal kosong. Tetap akhiri ujian?`
          : "Akhiri ujian dan tampilkan nilai?",
      )
    ) {
      return;
    }

    setSubmitting(true);
    setError("");
    const response = await fetch("/api/mocks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, answers }),
    });
    const data = await response.json();
    setSubmitting(false);
    if (!response.ok) {
      setError(data.error || "Gagal mengirim jawaban");
      return;
    }
    setResult(data);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (result) {
    return (
      <ScoringReport title={title} problems={problems} result={result} />
    );
  }

  if (!sessionId || !endsAt) {
    return (
      <section className="panel mx-auto max-w-3xl space-y-6 rounded-3xl p-7">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Simulasi penuh
          </p>
          <h1 className="display text-4xl">{title}</h1>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <ExamFact label="Jumlah soal" value={`${problems.length} soal`} />
          <ExamFact label="Durasi" value={`${durationMinutes / 60} jam`} />
          <ExamFact label="Skor maksimum" value={`${problems.length} poin`} />
        </div>
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
          <li>Timer dimulai setelah tombol mulai ditekan.</li>
          <li>Semua soal ditampilkan dalam satu halaman dan tersimpan otomatis.</li>
          <li>AI tutor dinonaktifkan selama ujian.</li>
          <li>Sesi aktif akan dilanjutkan jika halaman sempat tertutup.</li>
          <li>Ujian otomatis dikumpulkan saat waktu habis.</li>
        </ul>
        {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
        <button
          className="btn btn-primary w-full"
          onClick={start}
          disabled={starting}
        >
          {starting ? "Menyiapkan…" : `Mulai simulasi ${durationMinutes} menit`}
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-[68px] z-30 rounded-2xl border border-[var(--line)] bg-[rgba(243,239,230,0.95)] p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="display text-2xl">{title}</h1>
            <p className="text-xs text-[var(--muted)]">
              Terjawab {answeredCount}/{problems.length} · tersimpan otomatis
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Countdown endsAt={endsAt} onExpire={() => submit(true)} />
            <button
              className="btn btn-accent"
              onClick={() => submit(false)}
              disabled={submitting}
            >
              {submitting ? "Mengirim…" : "Akhiri ujian"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-[var(--bad)]">
          {error}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[180px_1fr]">
        <aside className="panel rounded-3xl p-4 lg:sticky lg:top-[160px]">
          <p className="mb-3 text-sm font-semibold">Navigasi soal</p>
          <div className="grid grid-cols-5 gap-2 lg:grid-cols-4">
            {problems.map((problem, index) => (
              <a
                key={problem.id}
                href={`#question-${index + 1}`}
                className={`flex h-8 items-center justify-center rounded-lg text-xs ${
                  answers[problem.id]?.trim()
                    ? "bg-[var(--accent)] text-white"
                    : "bg-white/70 text-[var(--muted)]"
                }`}
              >
                {index + 1}
              </a>
            ))}
          </div>
        </aside>

        <div className="space-y-5">
          {problems.map((problem, index) => (
            <article
              id={`question-${index + 1}`}
              key={problem.id}
              className="panel scroll-mt-44 space-y-4 rounded-3xl p-5 [contain-intrinsic-size:320px] [content-visibility:auto]"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="display text-2xl">
                  {index + 1}. {problem.title}
                </h2>
                <span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-xs text-[var(--muted)]">
                  1 poin
                </span>
              </div>
              <Markdown content={problem.stem} />
              {problem.answerType === "mcq" && problem.choices ? (
                <div className="space-y-2">
                  {problem.choices.map((choice) => (
                    <label
                      key={choice}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 hover:bg-white"
                    >
                      <input
                        type="radio"
                        name={problem.id}
                        checked={answers[problem.id] === choice}
                        onChange={() =>
                          setAnswers((current) => ({
                            ...current,
                            [problem.id]: choice,
                          }))
                        }
                      />
                      {choice}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  className="input"
                  value={answers[problem.id] ?? ""}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [problem.id]: event.target.value,
                    }))
                  }
                  placeholder="Tulis jawaban"
                  autoComplete="off"
                />
              )}
            </article>
          ))}
          <button
            className="btn btn-accent w-full"
            onClick={() => submit(false)}
            disabled={submitting}
          >
            {submitting ? "Mengirim jawaban…" : "Selesai & lihat laporan nilai"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExamFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/60 p-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function ScoringReport({
  title,
  problems,
  result,
}: {
  title: string;
  problems: Problem[];
  result: Result;
}) {
  const trackRows = Object.entries(result.byTrack).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const topicRows = Object.entries(result.byTopic).sort(
    ([, a], [, b]) => a.score / a.maxScore - b.score / b.maxScore,
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Laporan penilaian
        </p>
        <h1 className="display text-4xl">Hasil {title}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <ExamFact
          label="Skor"
          value={`${result.score}/${result.maxScore}`}
        />
        <ExamFact label="Persentase" value={`${result.percentage}%`} />
        <ExamFact label="Benar" value={String(result.correctCount)} />
        <ExamFact
          label="Salah / kosong"
          value={`${result.incorrectCount} / ${result.unansweredCount}`}
        />
        <ExamFact label="Waktu" value={formatDuration(result.elapsedMs)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel rounded-3xl p-5">
          <h2 className="display mb-4 text-2xl">Skor per materi</h2>
          <div className="space-y-3">
            {trackRows.map(([track, item]) => {
              const percentage = Math.round((item.score / item.maxScore) * 100);
              return (
                <div key={track}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>
                      Track {track}{" "}
                      {TRACKS[track as keyof typeof TRACKS]?.name ?? ""}
                    </span>
                    <strong>
                      {item.score}/{item.maxScore} ({percentage}%)
                    </strong>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/10">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel rounded-3xl p-5">
          <h2 className="display mb-4 text-2xl">Gap berdasarkan topik</h2>
          <div className="space-y-2 text-sm">
            {topicRows.map(([topic, item]) => (
              <div
                key={topic}
                className="flex justify-between border-b border-[var(--line)] py-2"
              >
                <span>{TOPIC_LABELS[topic] ?? topic}</span>
                <strong>
                  {item.score}/{item.maxScore} ·{" "}
                  {Math.round((item.score / item.maxScore) * 100)}%
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="display text-3xl">Rincian jawaban</h2>
        {problems.map((problem, index) => {
          const item = result.breakdown[problem.id];
          const unanswered =
            item?.submitted === undefined ||
            item?.submitted === null ||
            String(item?.submitted).trim() === "";
          return (
            <div key={problem.id} className="panel rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {index + 1}. {problem.title}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Jawabanmu:{" "}
                    {unanswered ? "Tidak dijawab" : String(item.submitted)}
                    {" · "}Kunci: {String(item?.expected)}
                  </p>
                </div>
                <span
                  className={
                    item?.correct
                      ? "text-sm font-semibold text-[var(--ok)]"
                      : "text-sm font-semibold text-[var(--bad)]"
                  }
                >
                  {item?.correct ? "Benar" : unanswered ? "Kosong" : "Salah"}
                </span>
              </div>
              <Link
                href={`/review/${problem.id}`}
                className="btn btn-secondary mt-3 !py-1.5"
              >
                Review solusi + Tutor AI
              </Link>
            </div>
          );
        })}
      </section>
    </div>
  );
}
