"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from "recharts";
import Link from "next/link";

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
  totals: { attempts: number; accuracy: number; avgDurationMs: number };
  recentMocks: {
    id: string;
    mockId: string;
    status: string;
    score: number | null;
    maxScore: number | null;
  }[];
};

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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Mastery keseluruhan",
            value: `${Math.round(data.overall * 100)}%`,
          },
          {
            label: "Akurasi terkini",
            value: `${Math.round(data.totals.accuracy * 100)}%`,
          },
          {
            label: "Rata-rata waktu",
            value: `${Math.round(data.totals.avgDurationMs / 1000)}s`,
          },
        ].map((c) => (
          <div key={c.label} className="panel rounded-3xl p-5">
            <p className="text-sm text-[var(--muted)]">{c.label}</p>
            <p className="display mt-2 text-4xl">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel rounded-3xl p-5">
          <h2 className="display mb-4 text-2xl">Mastery per topik</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartTopics}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="mastery" fill="#0f6e56" radius={[8, 8, 0, 0]} />
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
        <h2 className="display mb-3 text-2xl">Riwayat simulasi</h2>
        <ul className="space-y-2 text-sm">
          {data.recentMocks.length === 0 && (
            <li className="text-[var(--muted)]">Belum ada simulasi.</li>
          )}
          {data.recentMocks.map((m) => (
            <li key={m.id} className="flex justify-between border-b border-[var(--line)] py-2">
              <span>{m.mockId}</span>
              <span>
                {m.status === "submitted"
                  ? `${m.score}/${m.maxScore}`
                  : m.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
