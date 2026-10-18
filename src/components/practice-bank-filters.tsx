"use client";

import { useMemo, useState } from "react";
import { PracticeProblemCard } from "@/components/practice-problem-card";
import type { ProblemProgress } from "@/lib/attempts";

export type PracticeBankItem = {
  id: string;
  title: string;
  meta: string;
  difficulty: number;
  progress?: ProblemProgress;
};

type StatusFilter = "all" | "todo" | "done" | "retry";

function matchesStatus(
  progress: ProblemProgress | undefined,
  status: StatusFilter,
) {
  const attempted = Boolean(progress && progress.attemptCount > 0);
  if (status === "all") return true;
  if (status === "todo") return !attempted;
  if (status === "done") return attempted && progress!.bestScore >= 1;
  return attempted && progress!.bestScore < 1;
}

function filterItems(
  items: PracticeBankItem[],
  query: string,
  status: StatusFilter,
) {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (!matchesStatus(item.progress, status)) return false;
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.meta.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  });
}

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "todo", label: "Belum dikerjakan" },
  { id: "done", label: "Sudah benar" },
  { id: "retry", label: "Perlu diulang" },
];

export function PracticeBankFilters({
  shared,
  curated,
  totalCount,
  doneCount,
  avgBestPct,
}: {
  shared: PracticeBankItem[];
  curated: PracticeBankItem[];
  totalCount: number;
  doneCount: number;
  avgBestPct: number;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filteredShared = useMemo(
    () => filterItems(shared, query, status),
    [shared, query, status],
  );
  const filteredCurated = useMemo(
    () => filterItems(curated, query, status),
    [curated, query, status],
  );

  const progressPct =
    totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  return (
    <div className="space-y-6">
      <div className="panel space-y-4 rounded-3xl p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Progress bank soal
            </p>
            <p className="text-sm text-[var(--muted)]">
              {doneCount}/{totalCount} quest dikerjakan
              {doneCount > 0 ? ` · rata-rata skor terbaik ${avgBestPct}%` : ""}
            </p>
          </div>
          <span className="text-sm font-medium">{progressPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="input flex-1"
            type="search"
            placeholder="Cari judul atau kata kunci…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cari soal"
          />
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatus(opt.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  status === opt.id
                    ? "bg-[var(--accent)] text-white"
                    : "bg-white/70 text-[var(--muted)] hover:bg-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredShared.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="display text-2xl">Bank soal AI bersama</h2>
            <p className="text-sm text-[var(--muted)]">
              Dihasilkan siswa lain (atau kamu) dan bisa dikerjakan siapa saja.
            </p>
          </div>
          <div className="grid gap-3">
            {filteredShared.map((p) => (
              <PracticeProblemCard key={p.id} {...p} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="display text-2xl">Bank curated</h2>
        {filteredCurated.length === 0 && filteredShared.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Tidak ada soal yang cocok dengan filter saat ini.
          </p>
        ) : filteredCurated.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Tidak ada soal curated yang cocok.
          </p>
        ) : (
          <div className="grid gap-3">
            {filteredCurated.map((p) => (
              <PracticeProblemCard key={p.id} {...p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
