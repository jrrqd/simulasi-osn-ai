"use client";

import { useEffect, useRef, useState } from "react";
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
import { AlertTriangle, Trash2 } from "lucide-react";
import { masteryFill } from "@/lib/charts/mastery-color";
import {
  formatBirthDateWib,
  formatDateTimeWib,
  formatDateWib,
} from "@/lib/datetime";
import { CampaignEvolution } from "@/components/campaign-evolution";
import type { CampaignStages } from "@/lib/campaign-stages";

type ResetScope = "in_progress_only" | "all_mocks" | "full_reset";
type ResetBehavior = "hard_delete" | "soft_abandon";

type ResetAction = {
  scope: ResetScope;
  behavior: ResetBehavior;
  label: string;
  description: string;
};

type SessionDeleteAction = {
  mockSessionId: string;
  behavior: ResetBehavior;
  label: string;
  description: string;
};

const RESET_ACTIONS: Record<string, ResetAction> = {
  delete_in_progress: {
    scope: "in_progress_only",
    behavior: "hard_delete",
    label: "Hapus sesi berjalan",
    description: "Hapus sesi simulasi yang masih in_progress.",
  },
  mark_abandoned_in_progress: {
    scope: "in_progress_only",
    behavior: "soft_abandon",
    label: "Tandai abandoned (in_progress)",
    description: "Set status sesi yang masih in_progress menjadi abandoned.",
  },
  mark_abandoned_submitted: {
    scope: "all_mocks",
    behavior: "soft_abandon",
    label: "Tandai abandoned (semua mock)",
    description: "Set status semua mock siswa ini menjadi abandoned.",
  },
  delete_all_mocks: {
    scope: "all_mocks",
    behavior: "hard_delete",
    label: "Hapus semua sesi mock",
    description:
      "Hapus semua mockSessions siswa ini beserta attempts yang terkait.",
  },
  full_reset: {
    scope: "full_reset",
    behavior: "hard_delete",
    label: "Reset total data siswa",
    description:
      "Hapus mockSessions, attempts, topicMastery, dan lessonProgress.",
  },
};

function sessionDeleteAction(
  mockSessionId: string,
  behavior: ResetBehavior,
): SessionDeleteAction {
  if (behavior === "hard_delete") {
    return {
      mockSessionId,
      behavior,
      label: "Hapus sesi ini",
      description:
        "Hapus satu sesi mock ini. Jika sudah disubmit, attempts sesi itu dihapus lalu topic mastery dihitung ulang dari sisa attempts (latihan + mock lain tetap). Skor readiness bisa berubah karena rata-rata skor mock ikut tanpa sesi ini.",
    };
  }
  return {
    mockSessionId,
    behavior,
    label: "Tandai abandoned",
    description:
      "Set status sesi ini menjadi abandoned. Data tetap tersimpan untuk audit.",
  };
}

function MockStatusBadge({ status }: { status: string }) {
  if (status === "abandoned") {
    return (
      <span className="ml-2 inline-flex items-center rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]">
        Dibatalkan admin
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="ml-2 inline-flex items-center rounded-full bg-[rgba(161,92,7,0.12)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warn)]">
        In progress
      </span>
    );
  }
  return null;
}

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
    id: string;
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
    status: "in_progress" | "submitted" | "abandoned" | string;
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
  const [resetPending, setResetPending] = useState<ResetAction | null>(null);
  const [sessionPending, setSessionPending] =
    useState<SessionDeleteAction | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const sessionConfirmRef = useRef<HTMLDivElement | null>(null);

  const loadReport = () => {
    fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Gagal memuat laporan");
        setData(body);
        setError("");
      })
      .catch((err) => setError(err.message));
  };

  useEffect(loadReport, [userId]);

  useEffect(() => {
    if (!sessionPending) return;
    sessionConfirmRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [sessionPending]);

  const formatCountsMessage = (
    behavior: ResetBehavior,
    counts:
      | {
          mockSessions?: number;
          attempts?: number;
          topicMastery?: number;
          lessonProgress?: number;
          abandoned?: number;
        }
      | undefined,
  ) => {
    const parts: string[] = [];
    if (behavior === "soft_abandon") {
      parts.push(
        `${counts?.abandoned ?? counts?.mockSessions ?? 0} sesi ditandai abandoned`,
      );
    } else {
      if ((counts?.mockSessions ?? 0) > 0)
        parts.push(`${counts?.mockSessions} mockSessions`);
      if ((counts?.attempts ?? 0) > 0)
        parts.push(`${counts?.attempts} attempts`);
      if ((counts?.topicMastery ?? 0) > 0)
        parts.push(`${counts?.topicMastery} topic mastery`);
      if ((counts?.lessonProgress ?? 0) > 0)
        parts.push(`${counts?.lessonProgress} lesson progress`);
      parts.push("dihapus");
    }
    return parts.join(", ");
  };

  const performReset = async (action: ResetAction) => {
    setResetBusy(true);
    setResetError("");
    setResetMessage("");
    try {
      const response = await fetch("/api/admin/users/reset-mock-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          scope: action.scope,
          behavior: action.behavior,
          confirm: true,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Gagal mereset sesi");
      }
      setResetMessage(formatCountsMessage(action.behavior, body.counts));
      setResetPending(null);
      loadReport();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Gagal mereset sesi");
    } finally {
      setResetBusy(false);
    }
  };

  const performSessionDelete = async (action: SessionDeleteAction) => {
    setResetBusy(true);
    setResetError("");
    setResetMessage("");
    try {
      const response = await fetch("/api/admin/users/delete-mock-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          mockSessionId: action.mockSessionId,
          behavior: action.behavior,
          confirm: true,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Gagal menghapus sesi");
      }
      const parts: string[] = [];
      if (action.behavior === "soft_abandon") {
        parts.push(
          `${body.counts?.abandoned ?? body.counts?.mockSessions ?? 0} sesi ditandai abandoned`,
        );
      } else {
        if ((body.counts?.mockSessions ?? 0) > 0)
          parts.push(`${body.counts.mockSessions} sesi dihapus`);
        if ((body.counts?.attempts ?? 0) > 0)
          parts.push(`${body.counts.attempts} attempts sesi`);
        if ((body.counts?.topicMastery ?? 0) > 0)
          parts.push(
            `topic mastery dihitung ulang (${body.counts.topicMastery} topik)`,
          );
      }
      setResetMessage(parts.join(", ") || "Selesai");
      setSessionPending(null);
      loadReport();
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : "Gagal menghapus sesi",
      );
    } finally {
      setResetBusy(false);
    }
  };

  if (error) return <p className="text-[var(--bad)]">{error}</p>;
  if (!data) return <p className="text-[var(--muted)]">Memuat laporan…</p>;

  const topicChart = data.topics.map((item) => ({
    name: item.label.slice(0, 14),
    mastery: Math.round(item.mastery * 100),
  }));
  const sessionChart = data.sessionScores.map((item) => ({
    id: item.id,
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

      <div className="panel rounded-3xl border border-[var(--bad)]/30 p-5">
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle
            size={20}
            className="mt-0.5 shrink-0 text-[var(--bad)]"
            aria-hidden
          />
          <div>
            <h2 className="display text-2xl">Tindakan admin</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Bersihkan sesi simulasi siswa ini. Tindakan destructive tidak
              dapat dibatalkan.
            </p>
          </div>
        </div>

        {resetMessage && (
          <p className="mb-3 rounded-2xl bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent)]">
            Berhasil: {resetMessage}.
          </p>
        )}
        {resetError && (
          <p className="mb-3 rounded-2xl bg-[var(--bad)]/10 px-3 py-2 text-sm text-[var(--bad)]">
            {resetError}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            RESET_ACTIONS.delete_in_progress,
            RESET_ACTIONS.mark_abandoned_in_progress,
            RESET_ACTIONS.mark_abandoned_submitted,
            RESET_ACTIONS.delete_all_mocks,
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => setResetPending(action)}
              disabled={resetBusy}
              className="rounded-2xl border border-[var(--line)] bg-white/60 p-3 text-left text-sm transition hover:border-[var(--bad)] disabled:opacity-50"
            >
              <p className="font-semibold">{action.label}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {action.description}
              </p>
            </button>
          ))}
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setResetPending(RESET_ACTIONS.full_reset)}
            disabled={resetBusy}
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--bad)] bg-[var(--bad)]/10 px-4 py-2 text-sm font-semibold text-[var(--bad)] transition hover:bg-[var(--bad)]/15 disabled:opacity-50"
          >
            <Trash2 size={16} aria-hidden />
            {RESET_ACTIONS.full_reset.label}
          </button>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {RESET_ACTIONS.full_reset.description}
          </p>
        </div>

        {resetPending && (
          <div className="mt-4 rounded-2xl border border-[var(--bad)]/40 bg-[var(--bad)]/5 p-4">
            <p className="text-sm font-semibold">{resetPending.label}?</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {resetPending.description}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => performReset(resetPending)}
                disabled={resetBusy}
                className="rounded-full bg-[var(--bad)] px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {resetBusy ? "Memproses…" : "Konfirmasi"}
              </button>
              <button
                type="button"
                onClick={() => setResetPending(null)}
                disabled={resetBusy}
                className="rounded-full border border-[var(--line)] px-4 py-1.5 text-sm transition hover:border-[var(--bad)] disabled:opacity-50"
              >
                Batal
              </button>
            </div>
          </div>
        )}
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
          Tren skor submit (persen) dari sesi tertua ke terbaru. Klik titik sesi
          untuk menghapus atau menandai abandoned.
        </p>
        {sessionPending && (
          <div
            ref={sessionConfirmRef}
            className="mb-4 rounded-2xl border border-[var(--bad)]/40 bg-[var(--bad)]/5 p-4"
          >
            <p className="text-sm font-semibold">{sessionPending.label}?</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {sessionPending.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  performSessionDelete(
                    sessionDeleteAction(
                      sessionPending.mockSessionId,
                      "hard_delete",
                    ),
                  )
                }
                disabled={resetBusy}
                className="rounded-full bg-[var(--bad)] px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {resetBusy ? "Memproses…" : "Konfirmasi hapus"}
              </button>
              <button
                type="button"
                onClick={() =>
                  performSessionDelete(
                    sessionDeleteAction(
                      sessionPending.mockSessionId,
                      "soft_abandon",
                    ),
                  )
                }
                disabled={resetBusy}
                className="rounded-full border border-[var(--warn)] px-4 py-1.5 text-sm font-semibold text-[var(--warn)] transition hover:bg-[var(--warn)]/10 disabled:opacity-50"
              >
                Tandai abandoned
              </button>
              <button
                type="button"
                onClick={() => setSessionPending(null)}
                disabled={resetBusy}
                className="rounded-full border border-[var(--line)] px-4 py-1.5 text-sm transition hover:border-[var(--bad)] disabled:opacity-50"
              >
                Batal
              </button>
            </div>
          </div>
        )}
        {sessionChart.length ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sessionChart}
                style={{ cursor: "pointer" }}
                onClick={(nextState) => {
                  const rawIndex =
                    nextState.activeTooltipIndex ?? nextState.activeIndex;
                  const index =
                    typeof rawIndex === "number"
                      ? rawIndex
                      : typeof rawIndex === "string"
                        ? Number(rawIndex)
                        : NaN;
                  if (!Number.isFinite(index) || index < 0) return;
                  const point = sessionChart[index];
                  if (!point?.id) return;
                  setSessionPending(
                    sessionDeleteAction(point.id, "hard_delete"),
                  );
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip
                  formatter={(value, _name, props) => [
                    `${value}% (${props.payload.detail})`,
                    "Skor",
                  ]}
                  labelFormatter={(label) =>
                    `${label} · klik untuk hapus / abandoned`
                  }
                />
                <Line
                  dataKey="skor"
                  stroke="#0f6e56"
                  strokeWidth={2.5}
                  type="monotone"
                  isAnimationActive={false}
                  dot={(props) => {
                    const { cx, cy, payload, index } = props;
                    if (
                      typeof cx !== "number" ||
                      typeof cy !== "number" ||
                      !payload?.id
                    ) {
                      return <g key={`dot-empty-${index}`} />;
                    }
                    return (
                      <g key={`dot-${payload.id}`}>
                        {/* Larger invisible hit target */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={14}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSessionPending(
                              sessionDeleteAction(payload.id, "hard_delete"),
                            );
                          }}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill="#0f6e56"
                          stroke="#fff"
                          strokeWidth={1.5}
                          style={{ pointerEvents: "none" }}
                        />
                      </g>
                    );
                  }}
                  activeDot={(props) => {
                    const { cx, cy, payload } = props;
                    if (
                      typeof cx !== "number" ||
                      typeof cy !== "number" ||
                      !payload?.id
                    ) {
                      return <g />;
                    }
                    return (
                      <g>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={16}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSessionPending(
                              sessionDeleteAction(payload.id, "hard_delete"),
                            );
                          }}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={9}
                          fill="#0f6e56"
                          stroke="#fff"
                          strokeWidth={2}
                          style={{ pointerEvents: "none" }}
                        />
                      </g>
                    );
                  }}
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
        <p className="mb-3 text-sm text-[var(--muted)]">
          Hapus atau tandai abandoned satu sesi tertentu (mis. sesi outlier di
          grafik skor).
        </p>
        {sessionPending && (
          <div className="mb-4 rounded-2xl border border-[var(--bad)]/40 bg-[var(--bad)]/5 p-4">
            <p className="text-sm font-semibold">{sessionPending.label}?</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {sessionPending.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  performSessionDelete(
                    sessionDeleteAction(
                      sessionPending.mockSessionId,
                      "hard_delete",
                    ),
                  )
                }
                disabled={resetBusy}
                className="rounded-full bg-[var(--bad)] px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {resetBusy ? "Memproses…" : "Konfirmasi hapus"}
              </button>
              <button
                type="button"
                onClick={() =>
                  performSessionDelete(
                    sessionDeleteAction(
                      sessionPending.mockSessionId,
                      "soft_abandon",
                    ),
                  )
                }
                disabled={resetBusy}
                className="rounded-full border border-[var(--warn)] px-4 py-1.5 text-sm font-semibold text-[var(--warn)] transition hover:bg-[var(--warn)]/10 disabled:opacity-50"
              >
                Tandai abandoned
              </button>
              <button
                type="button"
                onClick={() => setSessionPending(null)}
                disabled={resetBusy}
                className="rounded-full border border-[var(--line)] px-4 py-1.5 text-sm transition hover:border-[var(--bad)] disabled:opacity-50"
              >
                Batal
              </button>
            </div>
          </div>
        )}
        <div className="space-y-2 text-sm">
          {data.mocks.map((mock) => (
            <div
              key={mock.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] py-2"
            >
              <span className="min-w-0 flex-1">
                {mock.mockId} · {formatDateTimeWib(mock.startedAt)}
                <MockStatusBadge status={mock.status} />
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
              {(mock.status === "in_progress" ||
                mock.status === "submitted") && (
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSessionPending(
                        sessionDeleteAction(mock.id, "hard_delete"),
                      )
                    }
                    disabled={resetBusy}
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-xs transition hover:border-[var(--bad)] disabled:opacity-50"
                  >
                    Hapus sesi
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSessionPending(
                        sessionDeleteAction(mock.id, "soft_abandon"),
                      )
                    }
                    disabled={resetBusy}
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-xs transition hover:border-[var(--warn)] disabled:opacity-50"
                  >
                    Tandai abandoned
                  </button>
                </span>
              )}
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
