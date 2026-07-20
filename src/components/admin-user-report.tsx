"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Report = {
  user: {
    name: string;
    email: string;
    role: string;
    createdAt: string;
    lastActiveAt: string;
  };
  totals: {
    attemptsCount: number;
    accuracy: number;
    practiceTimeMs: number;
    completedMocks: number;
  };
  topics: {
    topic: string;
    label: string;
    attempts: number;
    accuracy: number;
    timeMs: number;
    mastery: number;
  }[];
  activity: {
    day: string;
    attempts: number;
    timeMs: number;
    accuracy: number;
  }[];
  recentAttempts: {
    id: string;
    problemId: string;
    topic: string;
    source: string;
    score: number;
    maxScore: number;
    durationMs: number;
    createdAt: string;
  }[];
  mocks: {
    id: string;
    mockId: string;
    status: string;
    score: number | null;
    maxScore: number | null;
    startedAt: string;
  }[];
};

function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} menit`;
  return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}

export function AdminUserReport({ userId }: { userId: string }) {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Gagal memuat laporan");
        setData(body);
      })
      .catch((err) => setError(err.message));
  }, [userId]);

  if (error) return <p className="text-[var(--bad)]">{error}</p>;
  if (!data) return <p className="text-[var(--muted)]">Memuat laporan…</p>;

  const topicChart = data.topics.map((item) => ({
    name: item.label.slice(0, 14),
    mastery: Math.round(item.mastery * 100),
    accuracy: Math.round(item.accuracy * 100),
  }));
  const activityChart = data.activity.slice(-21).map((item) => ({
    ...item,
    accuracy: Math.round(item.accuracy * 100),
    minutes: Math.round(item.timeMs / 60_000),
  }));

  return (
    <div className="space-y-6">
      <div className="panel rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="display text-4xl">{data.user.name}</h1>
            <p className="text-[var(--muted)]">{data.user.email}</p>
          </div>
          <span className="rounded-full bg-white/70 px-3 py-1 text-sm">
            {data.user.role}
          </span>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Bergabung {new Date(data.user.createdAt).toLocaleDateString("id-ID")} ·
          terakhir aktif{" "}
          {new Date(data.user.lastActiveAt).toLocaleString("id-ID")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Attempt", value: data.totals.attemptsCount },
          {
            label: "Akurasi",
            value: `${Math.round(data.totals.accuracy * 100)}%`,
          },
          {
            label: "Waktu latihan",
            value: formatDuration(data.totals.practiceTimeMs),
          },
          { label: "Mock selesai", value: data.totals.completedMocks },
        ].map((item) => (
          <div key={item.label} className="panel rounded-3xl p-5">
            <p className="text-sm text-[var(--muted)]">{item.label}</p>
            <p className="display mt-2 text-3xl">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel rounded-3xl p-5">
          <h2 className="display mb-4 text-2xl">Mastery & akurasi topik</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topicChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="mastery" fill="#0f6e56" radius={[6, 6, 0, 0]} />
                <Bar dataKey="accuracy" fill="#c45c26" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel rounded-3xl p-5">
          <h2 className="display mb-4 text-2xl">Aktivitas harian</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.08)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Line
                  dataKey="attempts"
                  stroke="#0f6e56"
                  strokeWidth={2}
                  type="monotone"
                />
                <Line
                  dataKey="minutes"
                  stroke="#c45c26"
                  strokeWidth={2}
                  type="monotone"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="panel overflow-x-auto rounded-3xl p-5">
        <h2 className="display mb-4 text-2xl">Attempt terbaru</h2>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="py-2">Waktu</th>
              <th>Problem</th>
              <th>Topik</th>
              <th>Sumber</th>
              <th>Skor</th>
              <th>Durasi</th>
            </tr>
          </thead>
          <tbody>
            {data.recentAttempts.map((item) => (
              <tr key={item.id} className="border-b border-[var(--line)]">
                <td className="py-2">
                  {new Date(item.createdAt).toLocaleString("id-ID")}
                </td>
                <td>{item.problemId}</td>
                <td>{item.topic}</td>
                <td>{item.source}</td>
                <td>
                  {item.score}/{item.maxScore}
                </td>
                <td>{Math.round(item.durationMs / 1000)} dtk</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.recentAttempts.length && (
          <p className="py-4 text-sm text-[var(--muted)]">
            Belum ada attempt.
          </p>
        )}
      </div>

      <div className="panel rounded-3xl p-5">
        <h2 className="display mb-3 text-2xl">Riwayat mock</h2>
        <div className="space-y-2 text-sm">
          {data.mocks.map((mock) => (
            <div
              key={mock.id}
              className="flex items-center justify-between border-b border-[var(--line)] py-2"
            >
              <span>
                {mock.mockId} ·{" "}
                {new Date(mock.startedAt).toLocaleString("id-ID")}
              </span>
              <span>
                {mock.status === "submitted"
                  ? `${mock.score}/${mock.maxScore}`
                  : mock.status}
              </span>
            </div>
          ))}
          {!data.mocks.length && (
            <p className="text-[var(--muted)]">Belum ada mock.</p>
          )}
        </div>
      </div>
    </div>
  );
}
