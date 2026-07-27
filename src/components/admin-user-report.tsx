"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { masteryFill } from "@/lib/charts/mastery-color";
import {
  formatBirthDateWib,
  formatDateTimeWib,
  formatDateWib,
} from "@/lib/datetime";
import { CampaignEvolution } from "@/components/campaign-evolution";
import type { CampaignStages } from "@/lib/campaign-stages";

type Report = {
  user: {
    name: string;
    email: string;
    role: string;
    createdAt: string;
    lastActiveAt: string;
    birthDate: string | null;
    schoolName: string | null;
    grade: string | null;
    city: string | null;
  };
  totals: {
    attemptsCount: number;
    avgLifetimeScore: number;
    avgScorePoints: number;
    avgMaxPoints: number;
    practiceTimeMs: number;
    completedMocks: number;
  };
  readiness: {
    score: number;
    label: string;
    level: string;
    color: string;
    factors: {
      mastery: number;
      mockScore: number;
      coverage: number;
      mockVolume: number;
    };
    topGaps: { topic: string; label: string; mastery: number }[];
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
  sessionScores: {
    index: number;
    label: string;
    mockId: string;
    score: number;
    maxScore: number;
    percent: number;
    startedAt: string;
    submittedAt: string | null;
  }[];
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
    integrityFlagged?: boolean;
    integrityForcedSubmit?: boolean;
    integrityViolationCount?: number;
  }[];
};

function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} menit`;
  return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}

function formatAvgScore(totals: Report["totals"]) {
  if (!totals.completedMocks) return "—";
  const points = `${totals.avgScorePoints.toFixed(1)}/${Math.round(totals.avgMaxPoints)}`;
  const pct = `${Math.round(totals.avgLifetimeScore * 100)}%`;
  return `${points} · ${pct}`;
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
  }));
  const sessionChart = data.sessionScores.map((item) => ({
    name: item.label,
    skor: item.percent,
    detail: `${item.score}/${item.maxScore}`,
  }));
  const activityChart = data.activity.slice(-21).map((item) => ({
    ...item,
    minutes: Math.round(item.timeMs / 60_000),
  }));
  const readiness = data.readiness;
  const focusLine = readiness.topGaps.length
    ? `Fokus: ${readiness.topGaps.map((g) => g.label).join(", ")}`
    : null;

  return (
    <div className="space-y-6">
      <div className="panel rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="display text-4xl">{data.user.name}</h1>
            <p className="text-[var(--muted)]">{data.user.email}</p>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Bergabung {formatDateWib(data.user.createdAt)} · terakhir aktif{" "}
              {formatDateTimeWib(data.user.lastActiveAt)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-full bg-white/70 px-3 py-1 text-sm">
              {data.user.role}
            </span>
            <div className="w-52 max-w-full rounded-2xl border border-[var(--line)] bg-white/60 p-3">
              <p className="text-xs text-[var(--muted)]">Kesiapan OSN AI</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className="display text-3xl leading-none"
                  style={{ color: readiness.color }}
                >
                  {readiness.score}
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: readiness.color }}
                >
                  {readiness.label}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${readiness.score}%`,
                    background: readiness.color,
                  }}
                />
              </div>
              {focusLine && (
                <p className="mt-2 text-xs text-[var(--muted)]">{focusLine}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="panel rounded-3xl p-5">
        <h2 className="display mb-4 text-2xl">Profil siswa</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            {
              label: "Tanggal lahir",
              value: data.user.birthDate
                ? formatBirthDateWib(data.user.birthDate)
                : null,
            },
            { label: "Sekolah", value: data.user.schoolName },
            {
              label: "Kelas",
              value: data.user.grade ? `Kelas ${data.user.grade}` : null,
            },
            { label: "Kota", value: data.user.city },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-[var(--muted)]">{item.label}</dt>
              <dd className="mt-1 font-medium">{item.value || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Attempt", value: data.totals.attemptsCount },
          {
            label: "Rata-rata skor (lifetime)",
            value: formatAvgScore(data.totals),
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

      <div className="panel rounded-3xl p-5">
        <div className="mb-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Kampanye belajar
          </p>
          <h2 className="display text-2xl">Evolusi belajar</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Tahap Belajar → Latihan → Simulasi siswa ini.
          </p>
        </div>
        {data.campaign?.stages ? (
          <CampaignEvolution stages={data.campaign.stages} showLinks={false} />
        ) : (
          <p className="text-sm text-[var(--muted)]">Belum ada data tahap.</p>
        )}
      </div>

      <div className="panel rounded-3xl p-5">
        <h2 className="display mb-1 text-2xl">Skor per sesi mock</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Tren skor submit (persen) dari sesi tertua ke terbaru.
        </p>
        {sessionChart.length ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sessionChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip
                  formatter={(value, _name, props) => [
                    `${value}% (${props.payload.detail})`,
                    "Skor",
                  ]}
                />
                <Line
                  dataKey="skor"
                  stroke="#0f6e56"
                  strokeWidth={2.5}
                  type="monotone"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Belum ada mock yang disubmit.
          </p>
        )}
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <div className="panel flex flex-col rounded-3xl p-5">
          <div className="mb-4 min-h-[3.25rem]">
            <h2 className="display text-2xl">Mastery topik</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Merah = lemah · hijau = kuat
            </p>
          </div>
          <div className="h-72 min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topicChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="mastery" radius={[6, 6, 0, 0]}>
                  {topicChart.map((entry) => (
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

        <div className="panel flex flex-col rounded-3xl p-5">
          <div className="mb-4 min-h-[3.25rem]">
            <h2 className="display text-2xl">Aktivitas harian</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Hijau = attempts · oranye = menit
            </p>
          </div>
          <div className="h-72 min-h-0 flex-1">
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
                  {formatDateTimeWib(item.createdAt)}
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
              className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2"
            >
              <span>
                {mock.mockId} · {formatDateTimeWib(mock.startedAt)}
                {mock.integrityFlagged ? (
                  <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-[var(--bad)]">
                    Integritas
                    {typeof mock.integrityViolationCount === "number"
                      ? ` · ${mock.integrityViolationCount}`
                      : ""}
                    {mock.integrityForcedSubmit ? " · auto" : ""}
                  </span>
                ) : null}
              </span>
              <span>
                {mock.status === "submitted" &&
                mock.score != null &&
                mock.maxScore
                  ? `${mock.score}/${mock.maxScore} (${Math.round((mock.score / mock.maxScore) * 100)}%)`
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
