"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: string;
  userType?: string;
  attemptsCount: number;
  avgLifetimeScore: number;
  avgScorePoints: number;
  avgMaxPoints: number;
  practiceTimeMs: number;
  mocksCompleted: number;
  lastActiveAt: string;
};

function duration(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} menit`;
  return `${Math.floor(minutes / 60)}j ${minutes % 60}m`;
}

export function AdminOverview() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [sharedAi, setSharedAi] = useState<{
    configured: boolean;
    enabled: boolean;
    lastTestOk?: boolean;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then((res) => res.json()),
      fetch("/api/admin/settings/ai").then((res) => res.json()),
    ]).then(([usersData, aiData]) => {
      setUsers(usersData.users ?? []);
      setSharedAi(aiData);
    });
  }, []);

  const students = users.filter(
    (item) => item.role !== "admin" && item.userType !== "test",
  );
  const totals = useMemo(
    () => ({
      attempts: students.reduce((sum, item) => sum + item.attemptsCount, 0),
      practiceTime: students.reduce(
        (sum, item) => sum + item.practiceTimeMs,
        0,
      ),
      active: students.filter((item) => item.attemptsCount > 0).length,
    }),
    [students],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total siswa", value: students.length },
          { label: "Siswa aktif", value: totals.active },
          { label: "Total attempt", value: totals.attempts },
          { label: "Waktu latihan", value: duration(totals.practiceTime) },
        ].map((item) => (
          <div key={item.label} className="panel rounded-3xl p-5">
            <p className="text-sm text-[var(--muted)]">{item.label}</p>
            <p className="display mt-2 text-4xl">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="display text-2xl">LLM bersama</h2>
            <Link href="/admin/ai" className="btn btn-secondary !py-1.5">
              Atur
            </Link>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {!sharedAi
              ? "Memuat…"
              : sharedAi.configured && sharedAi.enabled && sharedAi.lastTestOk
                ? "Aktif dan siap digunakan siswa tanpa BYOK."
                : sharedAi.configured
                  ? "Tersimpan, tetapi belum siap atau dinonaktifkan."
                  : "Belum dikonfigurasi."}
          </p>
        </div>

        <div className="panel rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="display text-2xl">Siswa perlu perhatian</h2>
            <Link href="/admin/users" className="btn btn-secondary !py-1.5">
              Semua
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {students
              .filter((item) => item.mocksCompleted > 0)
              .sort((a, b) => a.avgLifetimeScore - b.avgLifetimeScore)
              .slice(0, 5)
              .map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between border-b border-[var(--line)] py-2"
                >
                  <Link href={`/admin/users/${item.id}`}>{item.name}</Link>
                  <span>
                    {item.avgScorePoints.toFixed(1)}/
                    {Math.round(item.avgMaxPoints)} (
                    {Math.round(item.avgLifetimeScore * 100)}%)
                  </span>
                </li>
              ))}
            {!students.some((item) => item.mocksCompleted > 0) && (
              <li className="text-[var(--muted)]">Belum ada mock selesai.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
