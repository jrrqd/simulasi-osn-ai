"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from "recharts";
import Link from "next/link";
import { masteryFill } from "@/lib/charts/mastery-color";
import { formatDateTimeWib } from "@/lib/datetime";
import { CampaignEvolution } from "@/components/campaign-evolution";
import type { CampaignStages } from "@/lib/campaign-stages";

type Perf = {
  overall: number;
  topics: {
    topic: string;
    label: string;
    track: string;
    mastery: number;
    attemptsCount: number;
    avgDurationMs: number;
  }[];
  gaps: {
    topic: string;
    label: string;
    mastery: number;
    lessonId?: string;
    practiceId?: string;
  }[];
  trend: { day: string; accuracy: number; attempts: number }[];
  readiness: {
    score: number;
    label: string;
    color: string;
    topGaps: { topic: string; label: string; mastery: number }[];
  };
  sessionScores: {
    index: number;
    label: string;
    score: number;
    maxScore: number;
    percent: number;
  }[];
  totals: {
    attempts: number;
    accuracy: number;
    avgDurationMs: number;
    completedMocks: number;
    avgLifetimeScore: number;
    avgScorePoints: number;
    avgMaxPoints: number;
  };
  recentMocks: {
    id: string;
    mockId: string;
    status: string;
    score: number | null;
    maxScore: number | null;
  }[];
  campaign: {
    levelsCompleted: number;
    totalLevels: number;
    sideQuestAttempts: number;
    sideQuestCorrect: number;
    sideQuestDone: number;
    sideQuestTotal: number;
    stages: CampaignStages;
  };
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
};

function formatAvgMockScore(totals: Perf["totals"]) {
  if (!totals.completedMocks) return "—";
  return `${totals.avgScorePoints.toFixed(1)}/${Math.round(totals.avgMaxPoints)} · ${Math.round(totals.avgLifetimeScore * 100)}%`;
}

export function PerformanceDashboard() {
  const [data, setData] = useState<Perf | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/performance")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Gagal memuat");
        setData(j);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-[var(--bad)]">{error}</p>;
  if (!data) return <p className="text-[var(--muted)]">Memuat performa…</p>;

  const chartTopics = data.topics
    .filter((t) => t.attemptsCount > 0)
    .map((t) => ({
      name: t.label.slice(0, 12),
      mastery: Math.round(t.mastery * 100),
    }));
  const sessionChart = data.sessionScores.map((item) => ({
    name: item.label,
    skor: item.percent,
    detail: `${item.score}/${item.maxScore}`,
  }));
  const focusLine = data.readiness.topGaps.length
    ? `Fokus: ${data.readiness.topGaps.map((g) => g.label).join(", ")}`
    : null;

  return (
    <div className="space-y-6">
      <div className="panel rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="display text-2xl">Kesiapan OSN AI</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ringkasan kesiapanmu berdasarkan mastery, skor mock, dan cakupan
              topik.
            </p>
            {focusLine && (
              <p className="mt-2 text-sm text-[var(--muted)]">{focusLine}</p>
            )}
          </div>
          <div className="w-56 max-w-full">
            <div className="flex items-baseline gap-2">
              <span
                className="display text-5xl leading-none"
                style={{ color: data.readiness.color }}
              >
                {data.readiness.score}
              </span>
              <span
                className="text-base font-semibold"
                style={{ color: data.readiness.color }}
              >
                {data.readiness.label}
              </span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${data.readiness.score}%`,
                  background: data.readiness.color,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          {
            label: "Mastery keseluruhan",
            value: `${Math.round(data.overall * 100)}%`,
          },
          {
            label: "Rata-rata skor mock",
            value: formatAvgMockScore(data.totals),
          },
          {
            label: "Akurasi terkini",
            value: `${Math.round(data.totals.accuracy * 100)}%`,
          },
          {
            label: "Mock selesai",
            value: data.totals.completedMocks,
          },
        ].map((c) => (
          <div key={c.label} className="panel rounded-3xl p-5">
            <p className="text-sm text-[var(--muted)]">{c.label}</p>
            <p className="display mt-2 text-3xl">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="panel rounded-3xl p-5">
        <div className="mb-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Kampanye belajar
          </p>
          <h2 className="display text-2xl">Evolusi belajar</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Tahap Belajar → Latihan → Simulasi. Bentuk menyala mengikuti
            progressmu (tanpa mengunci halaman).
          </p>
        </div>
        {data.campaign?.stages ? (
          <CampaignEvolution stages={data.campaign.stages} showLinks />
        ) : (
          <p className="text-sm text-[var(--muted)]">Memuat tahap kampanye…</p>
        )}
      </div>

      <div className="panel rounded-3xl p-5">
        <h2 className="display mb-1 text-2xl">Skor per sesi mock</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Tren skor submit (persen) dari sesi tertua ke terbaru.
        </p>
        {sessionChart.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sessionChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip
                  formatter={(value, _name, props) => [
                    `${value}% (${props.payload.detail})`,
                    "Skor",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="skor"
                  stroke="#0f6e56"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Belum ada simulasi yang disubmit. Kerjakan mock berwaktu untuk melihat tren.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel rounded-3xl p-5">
          <h2 className="display mb-1 text-2xl">Mastery per topik</h2>
          <p className="mb-4 text-xs text-[var(--muted)]">
            Merah = lemah · hijau = kuat
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartTopics}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="mastery" radius={[8, 8, 0, 0]}>
                  {chartTopics.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={masteryFill(entry.mastery)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel rounded-3xl p-5">
          <h2 className="display mb-4 text-2xl">Tren akurasi</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 1]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#c45c26"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="panel rounded-3xl p-5">
        <h2 className="display mb-3 text-2xl">Gap prioritas</h2>
        <div className="space-y-3">
          {data.gaps.map((g) => (
            <div
              key={g.topic}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white/50 px-4 py-3"
            >
              <div>
                <p className="font-semibold">{g.label}</p>
                <p className="text-sm text-[var(--muted)]">
                  Mastery {Math.round(g.mastery * 100)}%
                </p>
              </div>
              <div className="flex gap-2">
                {g.lessonId && (
                  <Link className="btn btn-secondary !py-1.5" href={`/study/${g.lessonId}`}>
                    Materi
                  </Link>
                )}
                {g.practiceId && (
                  <Link className="btn btn-primary !py-1.5" href={`/practice/${g.practiceId}`}>
                    Latihan
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

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
            <li key={m.id} className="flex justify-between border-b border-[var(--line)] py-2">
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
