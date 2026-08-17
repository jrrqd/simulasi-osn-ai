"use client";

import { useEffect, useState } from "react";
import {
  PHASE_HINTS,
  PHASE_LABELS,
  PHASE_VALUES,
  parsePhase,
  type Phase,
} from "@/lib/user/phase";

export function PhaseSettings() {
  const [phase, setPhase] = useState<Phase>("pre-seleksi");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setPhase(parsePhase(data.phase));
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat tahap");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(next: Phase) {
    setSaving(true);
    setError("");
    setSaved(false);
    setPhase(next);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Gagal menyimpan");
      setPhase(parsePhase(body.phase));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel rounded-3xl p-5">
      <h2 className="display text-2xl">Tahap OSN AI</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Mengatur bias topik mock AI (soft-weight). Tidak mengunci topik lain.
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Memuat…</p>
      ) : (
        <div className="mt-4 grid gap-2">
          {PHASE_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                phase === value
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--line)] bg-white/50 hover:bg-white/80"
              }`}
              disabled={saving}
              onClick={() => save(value)}
            >
              <p className="font-medium">{PHASE_LABELS[value]}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {PHASE_HINTS[value]}
              </p>
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-[var(--bad)]">{error}</p>}
      {saved && !error && (
        <p className="mt-3 text-sm text-[var(--accent)]">Tahap disimpan.</p>
      )}
    </div>
  );
}
