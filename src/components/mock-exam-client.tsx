"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { Markdown } from "@/components/markdown";
import { PythonRunner, preloadPyodide } from "@/components/python-runner";
import { CodeRunner } from "@/components/code-runner";
import { NumericInput } from "@/components/numeric-input";
import type { ExamFacingProblem } from "@/lib/content/exam-facing-problem";
import {
  needsCodeSpecRunner,
  needsExamPythonRunner,
} from "@/lib/ai/exam-python-policy";
import {
  TOPIC_LABELS,
  TRACKS,
  defaultProblemWeight,
  resolveNumericFormat,
} from "@/lib/content/types";
import {
  INTEGRITY_FLAG_AT,
  INTEGRITY_FORCE_SUBMIT_AT,
  type IntegrityState,
} from "@/lib/exam-integrity";
import { useExamIntegrity } from "@/hooks/use-exam-integrity";
import type { CodeSpecRunResult } from "@/lib/scoring/index";
import type { MockScoreSummary } from "@/lib/mocks/scoring";
import type {
  ProblemPenaltyState,
  ScoreboardRow,
  SessionPenaltyState,
} from "@/lib/exam/penalty";
import { DEFAULT_PENALTY_MINUTES_PER_WRONG } from "@/lib/exam/penalty";

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
      weightedScore?: number;
      weight?: number;
      expected: unknown;
      submitted: unknown;
      track: string;
      topic: string;
      isCoding?: boolean;
      passedCount?: number;
      totalCount?: number;
    }
  >;
  summary?: MockScoreSummary;
  integrity?: {
    violationCount: number;
    flagged: boolean;
    forcedSubmit: boolean;
  };
  penaltyEnabled?: boolean;
  penaltyMinutes?: number;
  totalAttempts?: number;
  scoreboard?: ScoreboardRow[];
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
  penaltyEnabled: penaltyEnabledProp = true,
  penaltyMinutesPerWrong: penaltyPerWrongProp = DEFAULT_PENALTY_MINUTES_PER_WRONG,
}: {
  mockId: string;
  title: string;
  durationMinutes: number;
  problems: ExamFacingProblem[];
  penaltyEnabled?: boolean;
  penaltyMinutesPerWrong?: number;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [codeResults, setCodeResults] = useState<
    Record<string, CodeSpecRunResult>
  >({});
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gradingProblemId, setGradingProblemId] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [submitFeedback, setSubmitFeedback] = useState<
    Record<string, string>
  >({});
  const [initialIntegrity, setInitialIntegrity] =
    useState<Partial<IntegrityState> | null>(null);
  const [penaltyEnabled, setPenaltyEnabled] = useState(penaltyEnabledProp);
  const [penaltyMinutesPerWrong, setPenaltyMinutesPerWrong] = useState(
    penaltyPerWrongProp,
  );
  const [penaltyState, setPenaltyState] = useState<SessionPenaltyState>({});
  const [penaltyMinutes, setPenaltyMinutes] = useState(0);
  const [totalAttemptsCount, setTotalAttemptsCount] = useState(0);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

  const answersRef = useRef(answers);
  const codeResultsRef = useRef(codeResults);
  const submittingRef = useRef(submitting);
  const sessionIdRef = useRef(sessionId);
  const penaltyStateRef = useRef(penaltyState);

  const hasPythonQuestions = useMemo(
    () => problems.some((p) => needsExamPythonRunner(p)),
    [problems],
  );

  const totalWeight = useMemo(
    () => problems.reduce((sum, p) => sum + defaultProblemWeight(p), 0),
    [problems],
  );

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    codeResultsRef.current = codeResults;
  }, [codeResults]);
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  useEffect(() => {
    penaltyStateRef.current = penaltyState;
  }, [penaltyState]);

  function applyPenaltyPayload(data: {
    penaltyState?: SessionPenaltyState;
    penaltyMinutes?: number;
    totalAttempts?: number;
    penaltyEnabled?: boolean;
    penaltyMinutesPerWrong?: number;
  }) {
    if (typeof data.penaltyEnabled === "boolean") {
      setPenaltyEnabled(data.penaltyEnabled);
    }
    if (typeof data.penaltyMinutesPerWrong === "number") {
      setPenaltyMinutesPerWrong(data.penaltyMinutesPerWrong);
    }
    if (data.penaltyState && typeof data.penaltyState === "object") {
      setPenaltyState(data.penaltyState);
    }
    if (typeof data.penaltyMinutes === "number") {
      setPenaltyMinutes(data.penaltyMinutes);
    }
    if (typeof data.totalAttempts === "number") {
      setTotalAttemptsCount(data.totalAttempts);
    }
  }

  useEffect(() => {
    if (sessionId && hasPythonQuestions) {
      preloadPyodide();
    }
  }, [sessionId, hasPythonQuestions]);

  const persistIntegrity = (state: IntegrityState) => {
    const id = sessionIdRef.current;
    if (!id) return;
    void fetch("/api/mocks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: id,
        integrity: {
          events: state.events,
          violationCount: state.violationCount,
          flagged: state.flagged,
          forcedSubmit: state.forcedSubmit,
        },
      }),
    });
  };

  const submitProblem = async (problemId: string) => {
    const id = sessionIdRef.current;
    if (!id || !penaltyEnabled) return;
    const row = penaltyStateRef.current[problemId];
    if (row?.solved || row?.lockedAt) return;

    setGradingProblemId(problemId);
    setError("");
    const response = await fetch("/api/mocks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: id,
        action: "submit_problem",
        problemId,
        answer: answersRef.current[problemId] ?? "",
      }),
    });
    const data = await response.json();
    setGradingProblemId(null);
    if (!response.ok) {
      setError(data.error || "Gagal menilai soal");
      return;
    }
    applyPenaltyPayload(data);
    if (data.formatHint) {
      setSubmitFeedback((c) => ({
        ...c,
        [problemId]: data.formatHint as string,
      }));
    } else if (data.correct) {
      setSubmitFeedback((c) => ({
        ...c,
        [problemId]: "Accepted — soal terkunci",
      }));
    } else if (data.alreadyLocked) {
      setSubmitFeedback((c) => ({
        ...c,
        [problemId]: "Soal sudah terkunci",
      }));
    } else {
      const attempts = (data.problemPenalty as ProblemPenaltyState | undefined)
        ?.attempts;
      setSubmitFeedback((c) => ({
        ...c,
        [problemId]: `Wrong answer${
          attempts ? ` · percobaan ke-${attempts}` : ""
        }`,
      }));
    }
  };

  const submitExam = async (
    force = false,
    options?: { integrityForced?: boolean; integrity?: IntegrityState },
  ) => {
    const id = sessionIdRef.current;
    if (!id || submittingRef.current) return;
    if (!force && !options?.integrityForced) {
      setSubmitConfirmOpen(true);
      return;
    }

    setSubmitting(true);
    setSubmitConfirmOpen(false);
    setError("");
    const response = await fetch("/api/mocks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: id,
          answers: answersRef.current,
          integrityForcedSubmit: options?.integrityForced === true,
        integrity: options?.integrity
          ? {
              events: options.integrity.events,
              violationCount: options.integrity.violationCount,
              flagged: options.integrity.flagged,
              forcedSubmit: options.integrity.forcedSubmit,
            }
          : undefined,
      }),
    });
    const data = await response.json();
    setSubmitting(false);
    if (!response.ok) {
      setError(data.error || "Gagal mengirim jawaban");
      return;
    }
    await exitFullscreen();
    setResult(data);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const answeredCount = useMemo(
    () =>
      problems.reduce(
        (count, problem) =>
          answers[problem.id]?.trim() ? count + 1 : count,
        0,
      ),
    [answers, problems],
  );
  const answeredCountRef = useRef(answeredCount);
  useEffect(() => {
    answeredCountRef.current = answeredCount;
  }, [answeredCount]);

  const {
    integrity,
    showReturnOverlay,
    dismissOverlay,
    requestFullscreen,
    exitFullscreen,
  } = useExamIntegrity({
    enabled: Boolean(sessionId && endsAt && !result),
    sessionId,
    initial: initialIntegrity,
    onPersist: persistIntegrity,
    onForceSubmit: (state) => {
      void submitExam(true, { integrityForced: true, integrity: state });
    },
  });

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

  async function start() {
    setStarting(true);
    setError("");
    // Request while still in the click gesture (best-effort).
    void requestFullscreen();
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
    if (data.integrity) {
      setInitialIntegrity(data.integrity);
    }
    applyPenaltyPayload(data);
    setSessionId(data.sessionId);
    setEndsAt(data.endsAt);
    setAnswers(data.answers ?? {});
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
          <ExamFact label="Skor maksimum" value={`${totalWeight} poin`} />
        </div>
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
          <li>Timer dimulai setelah tombol mulai ditekan.</li>
          <li>Semua soal ditampilkan dalam satu halaman dan tersimpan otomatis.</li>
          <li>
            Bobot: isian singkat = 1 poin · coding Python = 2 poin (skor
            dinormalisasi ke 100%).
          </li>
          <li>AI tutor dinonaktifkan selama ujian.</li>
          <li>Sesi aktif akan dilanjutkan jika halaman sempat tertutup.</li>
          <li>Ujian otomatis dikumpulkan saat waktu habis.</li>
          <li>
            Mode layar penuh akan diminta saat mulai. Jangan pindah ke tab lain
            atau jendela lain. Tetap di tab ujian diperbolehkan (termasuk
            runner Python di halaman). Jangan memakai alat eksternal / ekstensi
            AI.
          </li>
          {penaltyEnabledProp ? (
            <li>
              Submission penalty (tie-breaker ICPC): kumpulkan per soal untuk
              mendapat Accepted. Salah = +{penaltyPerWrongProp} menit penalti
              (jika akhirnya benar) + waktu tempuh. Skor utama tetap bobot
              kebenaran.
            </li>
          ) : null}
          <li>
            Pemantauan integritas: hanya meninggalkan tab (≥1,5 detik halaman
            tersembunyi) yang dihitung sebagai peringatan. {INTEGRITY_FLAG_AT}{" "}
            peringatan → sesi ditandai; {INTEGRITY_FORCE_SUBMIT_AT} peringatan →
            ujian dikumpulkan otomatis.
          </li>
          <li>
            Diam di tab ujian diperbolehkan — termasuk menghitung manual di
            kertas atau tidak mengklik apa pun. Tidak ada deteksi
            &quot;inaktivitas&quot; selama tab tetap terbuka.
          </li>
          <li>
            Platform web tidak bisa sepenuhnya memblokir ekstensi AI atau
            perangkat kedua — ini adalah deteksi dan audit, bukan lockdown.
          </li>
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
      {showReturnOverlay && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="panel max-w-md space-y-4 rounded-3xl p-6 text-center shadow-lg">
            <h2 className="display text-2xl">Kembali ke ujian</h2>
            <p className="text-sm text-[var(--muted)]">
              Kamu meninggalkan tab simulasi. Ini tercatat sebagai peringatan
              integritas ({integrity.violationCount}/
              {INTEGRITY_FORCE_SUBMIT_AT}).
            </p>
            {integrity.flagged && (
              <p className="text-sm font-semibold text-[var(--bad)]">
                Sesi ini sudah ditandai untuk tinjauan admin.
              </p>
            )}
            <button className="btn btn-primary w-full" onClick={dismissOverlay}>
              Lanjutkan ujian
            </button>
          </div>
        </div>
      )}

      {submitConfirmOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className="panel max-w-md space-y-4 rounded-3xl p-6 text-center shadow-lg">
            <h2 className="display text-2xl">Akhiri ujian?</h2>
            <p className="text-sm text-[var(--muted)]">
              {problems.length - answeredCount > 0
                ? `Masih ada ${problems.length - answeredCount} soal kosong. Tetap akhiri ujian dan tampilkan nilai?`
                : "Ujian akan dikumpulkan dan laporan nilai ditampilkan."}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => setSubmitConfirmOpen(false)}
                disabled={submitting}
              >
                Lanjutkan ujian
              </button>
              <button
                type="button"
                className="btn btn-accent w-full"
                onClick={() => void submitExam(true)}
                disabled={submitting}
              >
                {submitting ? "Mengirim…" : "Akhiri ujian"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-[68px] z-30 rounded-2xl border border-[var(--line)] bg-[rgba(243,239,230,0.95)] p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="display text-2xl">{title}</h1>
            <p className="text-xs text-[var(--muted)]">
              Terjawab {answeredCount}/{problems.length} · tersimpan otomatis
              {penaltyEnabled
                ? ` · penalti ${penaltyMinutes} mnt · ${totalAttemptsCount} submit`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {integrity.violationCount > 0 && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  integrity.flagged
                    ? "bg-red-100 text-[var(--bad)]"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                Peringatan: {integrity.violationCount}
              </span>
            )}
            <Countdown endsAt={endsAt} onExpire={() => void submitExam(true)} />
            <button
              className="btn btn-accent"
              onClick={() => void submitExam(false)}
              disabled={submitting}
            >
              {submitting ? "Mengirim…" : "Akhiri ujian"}
            </button>
          </div>
        </div>
        {penaltyEnabled ? (
          <SubmissionTracker
            problems={problems}
            penaltyState={penaltyState}
            penaltyMinutesPerWrong={penaltyMinutesPerWrong}
          />
        ) : null}
      </div>

      {integrity.flagged && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--bad)]">
          Sesi ditandai karena terlalu sering meninggalkan halaman. Hasil tetap
          dinilai, tetapi admin dapat melihat catatan integritas.
        </p>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-[var(--bad)]">
          {error}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[180px_1fr]">
        <aside className="panel rounded-3xl p-4 lg:sticky lg:top-[160px]">
          <p className="mb-3 text-sm font-semibold">Navigasi soal</p>
          <div className="grid grid-cols-5 gap-2 lg:grid-cols-4">
            {problems.map((problem, index) => {
              const locked = Boolean(
                penaltyState[problem.id]?.solved ||
                  penaltyState[problem.id]?.lockedAt,
              );
              const answered = Boolean(answers[problem.id]?.trim());
              return (
              <a
                key={problem.id}
                href={`#question-${index + 1}`}
                className={`flex h-8 items-center justify-center rounded-lg text-xs ${
                  locked
                    ? "bg-[var(--ok)] text-white"
                    : answered
                      ? "bg-[var(--accent)] text-white"
                      : "bg-white/70 text-[var(--muted)]"
                }`}
                title={
                  locked
                    ? "Accepted"
                    : penaltyState[problem.id]
                      ? `${penaltyState[problem.id]!.attempts} attempts`
                      : undefined
                }
              >
                {index + 1}
              </a>
              );
            })}
          </div>
        </aside>

        <div className="space-y-5">
          {problems.map((problem, index) => {
            const locked = Boolean(
              penaltyState[problem.id]?.solved ||
                penaltyState[problem.id]?.lockedAt,
            );
            const numericFormat = resolveNumericFormat(problem);
            const isNumeric =
              problem.answerType === "numeric" || Boolean(numericFormat);
            return (
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
                  {defaultProblemWeight(problem)} poin
                  {needsCodeSpecRunner(problem) ||
                  problem.answerType === "python_output"
                    ? " · coding"
                    : " · isian"}
                  {locked ? " · ✓ locked" : ""}
                </span>
              </div>
              <Markdown content={problem.stem} />
              {needsCodeSpecRunner(problem) && problem.codeSpec ? (
                <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-white/50 p-4">
                  <p className="text-xs text-[var(--muted)]">
                    Isi zona WRITE HERE saja. Tekan &quot;Jalankan tes&quot;
                    untuk menilai kode di server. Test case bersifat rahasia —
                    hanya jumlah lulus yang ditampilkan.
                  </p>
                  <CodeRunner
                    problemId={problem.id}
                    codeSpec={problem.codeSpec}
                    onResult={(agg, userCode) => {
                      if (locked) return;
                      setCodeResults((current) => ({
                        ...current,
                        [problem.id]: agg,
                      }));
                      setAnswers((current) => ({
                        ...current,
                        [problem.id]: userCode,
                      }));
                    }}
                    onCodeChange={(userCode) => {
                      if (locked) return;
                      setAnswers((current) => ({
                        ...current,
                        [problem.id]: userCode,
                      }));
                      setCodeResults((current) => {
                        if (!current[problem.id]) return current;
                        const next = { ...current };
                        delete next[problem.id];
                        return next;
                      });
                    }}
                  />
                </div>
              ) : problem.answerType === "mcq" && problem.choices ? (
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
                        disabled={locked}
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
              ) : isNumeric ? (
                <NumericInput
                  id={`ans-${problem.id}`}
                  value={answers[problem.id] ?? ""}
                  disabled={locked}
                  numericFormat={numericFormat}
                  partCount={problem.numericPartCount}
                  onChange={(next) =>
                    setAnswers((current) => ({
                      ...current,
                      [problem.id]: next,
                    }))
                  }
                />
              ) : (
                <input
                  className="input"
                  value={answers[problem.id] ?? ""}
                  disabled={locked}
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
              {!needsCodeSpecRunner(problem) &&
                needsExamPythonRunner(problem) && (
                <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-white/50 p-4">
                  <p className="text-xs text-[var(--muted)]">
                    Jalankan di sini — tetap di tab ujian. Output otomatis
                    mengisi kolom jawaban di atas.
                  </p>
                  <PythonRunner
                    initialCode={
                      problem.starterCode || "# tulis kode\nprint(0)"
                    }
                    onOutput={(out) => {
                      if (locked) return;
                      setAnswers((current) => ({
                        ...current,
                        [problem.id]: out,
                      }));
                    }}
                  />
                </div>
              )}
              {penaltyEnabled ? (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={
                      locked ||
                      gradingProblemId === problem.id ||
                      !answers[problem.id]?.trim()
                    }
                    onClick={() => void submitProblem(problem.id)}
                  >
                    {locked
                      ? "Terkunci (Accepted)"
                      : gradingProblemId === problem.id
                        ? "Menilai…"
                        : "Kumpulkan soal ini"}
                  </button>
                  {submitFeedback[problem.id] ? (
                    <p
                      className={`text-sm ${
                        locked || submitFeedback[problem.id]?.startsWith("Accepted")
                          ? "text-[var(--ok)]"
                          : "text-[var(--bad)]"
                      }`}
                    >
                      {submitFeedback[problem.id]}
                    </p>
                  ) : null}
                  {penaltyState[problem.id] ? (
                    <p className="text-xs text-[var(--muted)]">
                      {penaltyState[problem.id]!.attempts} attempts
                      {penaltyState[problem.id]!.solved
                        ? ` · penalti ${penaltyState[problem.id]!.penaltyMin} mnt`
                        : penaltyState[problem.id]!.wrongCount
                          ? ` · ${penaltyState[problem.id]!.wrongCount} WA`
                          : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </article>
            );
          })}
          <button
            className="btn btn-accent w-full"
            onClick={() => void submitExam(false)}
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

function SubmissionTracker({
  problems,
  penaltyState,
  penaltyMinutesPerWrong,
}: {
  problems: ExamFacingProblem[];
  penaltyState: SessionPenaltyState;
  penaltyMinutesPerWrong: number;
}) {
  return (
    <div className="mt-3 border-t border-[var(--line)] pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Submission tracker · +{penaltyMinutesPerWrong} mnt / WA (jika Accepted)
      </p>
      <div className="flex flex-wrap gap-1.5">
        {problems.map((problem, index) => {
          const row = penaltyState[problem.id];
          const solved = Boolean(row?.solved);
          const attempts = row?.attempts ?? 0;
          return (
            <a
              key={problem.id}
              href={`#question-${index + 1}`}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                solved
                  ? "bg-[rgba(31,122,76,0.18)] text-[var(--ok)]"
                  : attempts > 0
                    ? "bg-amber-100 text-amber-900"
                    : "bg-white/70 text-[var(--muted)]"
              }`}
              title={
                solved
                  ? `Accepted · penalti ${row?.penaltyMin ?? 0} mnt`
                  : attempts
                    ? `${attempts} attempts · ${row?.wrongCount ?? 0} WA`
                    : "Belum submit"
              }
            >
              <span>{index + 1}</span>
              <span>
                {solved ? "✓" : attempts ? `${attempts}` : "–"}
              </span>
              {solved ? (
                <span className="font-normal opacity-80">
                  {row?.penaltyMin ?? 0}m
                </span>
              ) : null}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function ScoringReport({
  title,
  problems,
  result,
}: {
  title: string;
  problems: ExamFacingProblem[];
  result: Result;
}) {
  const trackRows = Object.entries(result.byTrack).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const topicRows = Object.entries(result.byTopic).sort(
    ([, a], [, b]) => a.score / a.maxScore - b.score / b.maxScore,
  );
  const integrity = result.integrity;
  const summary = result.summary;
  const showPenalty = result.penaltyEnabled !== false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Laporan penilaian
          </p>
          <h1 className="display text-4xl">Hasil {title}</h1>
        </div>
        <Link href="/mock" className="btn btn-secondary">
          Kembali ke simulasi
        </Link>
      </div>

      {integrity?.flagged && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--bad)]">
          <p className="font-semibold">
            {integrity.forcedSubmit
              ? "Ujian dikumpulkan otomatis karena batas peringatan integritas."
              : "Sesi ditandai catatan integritas."}
          </p>
          <p className="mt-1">
            Peringatan meninggalkan halaman: {integrity.violationCount}. Skor
            di atas tetap dihitung seperti biasa.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <ExamFact
          label="Skor berbobot"
          value={`${roundScore(result.score)}/${roundScore(result.maxScore)}`}
        />
        <ExamFact label="Persentase" value={`${result.percentage}%`} />
        <ExamFact label="Benar" value={String(result.correctCount)} />
        <ExamFact
          label="Salah / kosong"
          value={`${result.incorrectCount} / ${result.unansweredCount}`}
        />
        <ExamFact label="Waktu" value={formatDuration(result.elapsedMs)} />
      </div>

      {showPenalty ? (
        <section className="panel space-y-4 rounded-3xl p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Tie-breaker (review)
            </p>
            <h2 className="display text-2xl">Penalti submission</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Tidak mengubah skor akhir. Dipakai hanya untuk memecah peringkat
              jika skor berbobot sama (lebih kecil = lebih baik). Formula: menit
              hingga Accepted + (jumlah WA × menit penalti per WA).
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ExamFact
              label="Total penalti"
              value={`${result.penaltyMinutes ?? 0} menit`}
            />
            <ExamFact
              label="Total submit"
              value={String(result.totalAttempts ?? 0)}
            />
            <ExamFact
              label="Soal Accepted (lock)"
              value={String(
                (result.scoreboard ?? []).filter((r) => r.solved).length,
              )}
            />
          </div>
        </section>
      ) : null}

      {summary ? (
        <section className="panel grid gap-3 rounded-3xl p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Bagian isian singkat
            </p>
            <p className="mt-1 font-semibold">
              {summary.numericCount} soal × bobot 1 = {roundScore(summary.numericWeight)} poin
            </p>
            <p className="text-sm text-[var(--muted)]">
              Perolehan: {roundScore(summary.numericEarned)}/
              {roundScore(summary.numericWeight)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Bagian coding Python
            </p>
            <p className="mt-1 font-semibold">
              {summary.codingCount} soal × bobot 2 = {roundScore(summary.codingWeight)} poin
            </p>
            <p className="text-sm text-[var(--muted)]">
              Perolehan: {roundScore(summary.codingEarned)}/
              {roundScore(summary.codingWeight)}
            </p>
          </div>
        </section>
      ) : null}

      {showPenalty && (result.scoreboard?.length ?? 0) > 0 ? (
        <section className="panel rounded-3xl p-5">
          <h2 className="display mb-1 text-2xl">Rincian penalti per soal</h2>
          <p className="mb-3 text-sm text-[var(--muted)]">
            Hanya untuk review / tie-breaker — tidak menambah atau mengurangi
            skor berbobot di atas.
          </p>
          <div className="space-y-2 text-sm">
            {problems.map((problem, index) => {
              const row = result.scoreboard?.find(
                (r) => r.problemId === problem.id,
              );
              return (
                <div
                  key={problem.id}
                  className="flex justify-between border-b border-[var(--line)] py-2"
                >
                  <span>
                    {index + 1}. {problem.title}
                  </span>
                  <strong>
                    {row?.solved
                      ? `Accepted · ${row.attempts} att · ${row.penaltyMin} mnt`
                      : row
                        ? `${row.attempts} att · belum Accepted`
                        : "–"}
                  </strong>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel rounded-3xl p-5">
          <h2 className="display mb-4 text-2xl">Skor per materi</h2>
          <div className="space-y-3">
            {trackRows.map(([track, item]) => {
              const percentage =
                item.maxScore === 0
                  ? 0
                  : Math.round((item.score / item.maxScore) * 100);
              return (
                <div key={track}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>
                      Track {track}{" "}
                      {TRACKS[track as keyof typeof TRACKS]?.name ?? ""}
                    </span>
                    <strong>
                      {roundScore(item.score)}/{roundScore(item.maxScore)} (
                      {percentage}%)
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
                  {roundScore(item.score)}/{roundScore(item.maxScore)} ·{" "}
                  {item.maxScore === 0
                    ? 0
                    : Math.round((item.score / item.maxScore) * 100)}
                  %
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
          const weight = item?.weight ?? defaultProblemWeight(problem);
          return (
            <div key={problem.id} className="panel rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {index + 1}. {problem.title}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {item?.isCoding ? "Coding" : "Isian"} · bobot {weight}
                    {item?.passedCount != null && item?.totalCount != null
                      ? ` · test case ${item.passedCount}/${item.totalCount}`
                      : ""}
                    {" · "}
                    Jawabanmu:{" "}
                    {unanswered
                      ? "Tidak dijawab"
                      : item?.isCoding
                        ? "(kode dikumpulkan)"
                        : String(item.submitted)}
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
                  {item?.correct
                    ? `Benar (+${roundScore(item.weightedScore ?? weight)})`
                    : unanswered
                      ? "Kosong"
                      : item?.score && item.score > 0
                        ? `Parsial ${roundScore(item.weightedScore ?? 0)}/${weight}`
                        : "Salah"}
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

function roundScore(n: number) {
  return Math.round(n * 100) / 100;
}
