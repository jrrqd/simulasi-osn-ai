"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  PROFILE_FIELD_LABELS,
  PROFILE_GRADES,
  type ProfileField,
} from "@/lib/profile";

type ProfileResponse = {
  birthDate: string | null;
  schoolName: string | null;
  grade: string | null;
  city: string | null;
  onboardingCompleted: boolean;
  profilePromptSnoozed: boolean;
  missingFields: ProfileField[];
};

function pickRandomField(fields: ProfileField[]) {
  if (fields.length === 0) return null;
  return fields[Math.floor(Math.random() * fields.length)] ?? null;
}

export function ProfilePrompt({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const onMockRoute = pathname === "/mock" || pathname.startsWith("/mock/");
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [field, setField] = useState<ProfileField | null>(null);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled || onMockRoute) return;
    const timer = window.setTimeout(() => setReady(true), 2500);
    return () => window.clearTimeout(timer);
  }, [enabled, onMockRoute]);

  useEffect(() => {
    if (!enabled || onMockRoute || !ready || dismissed) return;
    let cancelled = false;
    fetch("/api/profile")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Gagal memuat profil");
        if (cancelled) return;
        const data = body as ProfileResponse;
        setProfile(data);
        if (
          !data.onboardingCompleted ||
          data.profilePromptSnoozed ||
          data.missingFields.length === 0
        ) {
          setField(null);
          return;
        }
        const chosen = pickRandomField(data.missingFields);
        setField(chosen);
        setValue("");
      })
      .catch(() => {
        if (!cancelled) setField(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, onMockRoute, ready, dismissed, pathname]);

  const label = useMemo(
    () => (field ? PROFILE_FIELD_LABELS[field] : ""),
    [field],
  );

  if (!enabled || onMockRoute || !ready || dismissed || !field || !profile) {
    return null;
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!field) return;
    setLoading(true);
    setError("");
    try {
      const payload: Record<string, string> = { [field]: value.trim() };
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Gagal menyimpan");
      setDismissed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  async function onSnooze() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snoozeProfilePrompt: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Gagal menunda");
      setDismissed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(100%-2rem,22rem)]">
      <form
        onSubmit={onSave}
        className="panel rounded-3xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-[0_12px_40px_rgba(20,40,30,0.12)]"
      >
        <p className="text-xs font-medium text-[var(--accent)]">
          Lengkapi profil
        </p>
        <h2 className="display mt-1 text-xl">{label}?</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Opsional — membantu laporan untuk pembina. Bisa ditunda.
        </p>

        {field === "birthDate" && (
          <input
            className="input mt-3"
            type="date"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        {field === "schoolName" && (
          <input
            className="input mt-3"
            type="text"
            required
            minLength={2}
            placeholder="Contoh: SMAN 1 Bandung"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        {field === "grade" && (
          <select
            className="input mt-3"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">Pilih kelas</option>
            {PROFILE_GRADES.map((grade) => (
              <option key={grade} value={grade}>
                Kelas {grade}
              </option>
            ))}
          </select>
        )}
        {field === "city" && (
          <input
            className="input mt-3"
            type="text"
            required
            minLength={2}
            placeholder="Contoh: Bandung"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}

        {error && <p className="mt-2 text-xs text-[var(--bad)]">{error}</p>}

        <div className="mt-3 flex gap-2">
          <button className="btn btn-primary flex-1" disabled={loading} type="submit">
            {loading ? "…" : "Simpan"}
          </button>
          <button
            className="btn flex-1"
            type="button"
            disabled={loading}
            onClick={onSnooze}
          >
            Nanti saja
          </button>
        </div>
      </form>
    </div>
  );
}
