"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDateTimeWib } from "@/lib/datetime";

type HistoryData = {
  practiceSummary: {
    attempts: number;
    correct: number;
    done: number;
    total: number;
    accuracy: number;
    avgScore: number;
  };
  recentPractice: {
    id: string;
    problemId: string;
    title: string;
    topic: string;
    topicLabel: string;
    track: string;
    source: string;
    isCorrect: boolean;
    score: number;
    maxScore: number;
    durationMs: number;
    createdAt: string;
  }[];
  recentMocks: {
    id: string;
    mockId: string;
    status: string;
    score: number | null;
    maxScore: number | null;
  }[];
};

export function PerformanceHistory() {
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/performance")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Gagal memuat");
        setData(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"));
  }, []);

  if (error) return <p className="text-[var(--bad)]">{error}</p>;
  if (!data) return <p className="text-[var(--muted)]">Memuat riwayat…</p>;

  return (
    <div className="space-y-6">
      <div className="panel rounded-3xl p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Laporan penilaian
            </p>
            <h2 className="display text-2xl">Hasil latihan</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Riwayat soal latihan yang sudah kamu kerjakan (bukan simulasi).
            </p>
          </div>
          {data.practiceSummary.attempts > 0 ||
          data.practiceSummary.total > 0 ? (
            <div className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-4">
              <div className="rounded-2xl bg-black/[0.03] px-3 py-2">
                <p className="text-xs text-[var(--muted)]">Coverage</p>
                <p className="font-semibold tabular-nums">
                  {data.practiceSummary.done}/{data.practiceSummary.total}
                </p>
              </div>
              <div className="rounded-2xl bg-black/[0.03] px-3 py-2">
                <p className="text-xs text-[var(--muted)]">Attempt</p>
                <p className="font-semibold">{data.practiceSummary.attempts}</p>
              </div>
              <div className="rounded-2xl bg-black/[0.03] px-3 py-2">
                <p className="text-xs text-[var(--muted)]">Akurasi</p>
                <p className="font-semibold">
                  {data.practiceSummary.attempts > 0
                    ? `${Math.round(data.practiceSummary.accuracy * 100)}%`
                    : "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-black/[0.03] px-3 py-2">
                <p className="text-xs text-[var(--muted)]">Rata skor</p>
                <p className="font-semibold">
                  {data.practiceSummary.attempts > 0
                    ? `${Math.round(data.practiceSummary.avgScore * 100)}%`
                    : "—"}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {data.recentPractice.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Belum ada hasil latihan.{" "}
            <Link href="/practice" className="text-[var(--accent)] underline">
              Mulai latihan
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="py-2 pr-3 font-medium">Waktu</th>
                  <th className="py-2 pr-3 font-medium">Soal</th>
                  <th className="py-2 pr-3 font-medium">Topik</th>
                  <th className="py-2 pr-3 font-medium">Hasil</th>
                  <th className="py-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPractice.map((item) => {
                  const pct = Math.round(
                    (item.score / Math.max(item.maxScore || 1, 1)) * 100,
                  );
                  const timeLabel = formatDateTimeWib(item.createdAt, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--line)]/70 align-top"
                    >
                      <td className="py-2.5 pr-3 text-[var(--muted)]">
                        {timeLabel}
                      </td>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium leading-snug">{item.title}</p>
                        <p className="text-xs text-[var(--muted)]">
                          Track {item.track}
                          {item.source === "ai" ? " · AI" : ""}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3 text-[var(--muted)]">
                        {item.topicLabel}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.isCorrect
                              ? "bg-[rgba(31,122,76,0.14)] text-[var(--ok)]"
                              : "bg-[rgba(180,35,24,0.1)] text-[var(--bad)]"
                          }`}
                        >
                          {item.isCorrect ? "Benar" : "Belum tepat"} · {pct}%
                        </span>
                      </td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <Link
                            href={`/practice/${item.problemId}`}
                            className="btn btn-secondary !px-2.5 !py-1 text-xs"
                          >
                            Ulangi
                          </Link>
                          <Link
                            href={`/review/${item.problemId}?attempt=${item.id}`}
                            className="btn btn-primary !px-2.5 !py-1 text-xs"
                          >
                            Review
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel rounded-3xl p-5">
        <h2 className="display mb-3 text-2xl">Riwayat simulasi</h2>
        <ul className="space-y-2 text-sm">
          {data.recentMocks.length === 0 && (
            <li className="text-[var(--muted)]">Belum ada simulasi.</li>
          )}
          {data.recentMocks.map((m) => (
            <li
              key={m.id}
              className="flex justify-between border-b border-[var(--line)] py-2"
            >
              <span>{m.mockId}</span>
              <span>
                {m.status === "submitted" && m.score != null && m.maxScore
                  ? `${m.score}/${m.maxScore} (${Math.round((m.score / m.maxScore) * 100)}%)`
                  : m.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
