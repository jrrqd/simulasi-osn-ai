"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from "recharts";
import Link from "next/link";
import { masteryFill } from "@/lib/charts/mastery-color";
import { ChartBox } from "@/components/chart-box";
import { CampaignEvolution } from "@/components/campaign-evolution";
import type { CampaignStages } from "@/lib/campaign-stages";

type Perf = {
  overall: number;
  phase?: string;
  phaseLabel?: string;
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
  suggestedLessons?: {
    lessonId: string;
    title: string;
    topic: string;
    track: string;
    mastery: number;
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
  campaign: {
    levelsCompleted: number;
    totalLevels: number;
    sideQuestAttempts: number;
    sideQuestCorrect: number;
    sideQuestDone: number;
    sideQuestTotal: number;
    stages: CampaignStages;
  };
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
            {data.phase && data.phase !== "pre-seleksi" && (
              <p className="mt-2 inline-flex rounded-full bg-[var(--accent)]/12 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                Mode: {data.phaseLabel ?? data.phase} OSN AI 2026
              </p>
            )}
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
          <ChartBox height={256}>
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
          </ChartBox>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Belum ada simulasi yang disubmit. Kerjakan mock berwaktu untuk melihat tren.
          </p>
        )}
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <div className="panel flex flex-col rounded-3xl p-5">
          <div className="mb-4 min-h-[3.25rem]">
            <h2 className="display text-2xl">Mastery per topik</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Merah = lemah · hijau = kuat
            </p>
          </div>
          {chartTopics.length ? (
            <ChartBox height={256}>
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
            </ChartBox>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Belum ada data mastery topik.
            </p>
          )}
        </div>
        <div className="panel flex flex-col rounded-3xl p-5">
          <div className="mb-4 min-h-[3.25rem]">
            <h2 className="display text-2xl">Tren akurasi</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Skala 0–1 dari attempt harian
            </p>
          </div>
          {data.trend.length ? (
            <ChartBox height={256}>
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
            </ChartBox>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Belum ada tren attempt harian.
            </p>
          )}
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

      {data.suggestedLessons && data.suggestedLessons.length > 0 ? (
        <div className="panel rounded-3xl p-5">
          <h2 className="display mb-1 text-2xl">Lesson yang disarankan</h2>
          <p className="mb-3 text-sm text-[var(--muted)]">
            Topik lemah → modul belajar yang belum kamu selesaikan.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {data.suggestedLessons.map((s) => (
              <Link
                key={s.lessonId}
                href={`/study/${s.lessonId}`}
                className="rounded-2xl border border-[var(--line)] bg-white/60 p-4 hover:bg-white"
              >
                <p className="text-xs uppercase tracking-wide text-[var(--accent)]">
                  Track {s.track}
                </p>
                <p className="mt-1 font-semibold">{s.title}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Mastery topik {Math.round(s.mastery * 100)}%
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
