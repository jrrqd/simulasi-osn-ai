"use client";

import { appPath } from "@/lib/app-path";
import { FormEvent, useCallback, useEffect, useState } from "react";

type NewsSettings = {
  configured: boolean;
  enabled: boolean;
  keywords: string[];
  intervalHours: number;
  anchorHourWib: number;
  scheduleLabel?: string;
  lastRefreshAt?: string | null;
  lastRefreshOk?: boolean | null;
  lastRefreshMessage?: string | null;
  updatedAt?: string | null;
};

const INTERVAL_OPTIONS = [
  { value: 1, label: "Setiap jam" },
  { value: 6, label: "Setiap 6 jam" },
  { value: 12, label: "Setiap 12 jam" },
  { value: 24, label: "Setiap hari" },
] as const;

function formatWib(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AdminNewsSettings() {
  const [settings, setSettings] = useState<NewsSettings | null>(null);
  const [keywordsText, setKeywordsText] = useState("");
  const [intervalHours, setIntervalHours] = useState(24);
  const [anchorHourWib, setAnchorHourWib] = useState(6);
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const apply = useCallback((data: NewsSettings) => {
    setSettings(data);
    setKeywordsText((data.keywords ?? []).join("\n"));
    setIntervalHours(data.intervalHours ?? 24);
    setAnchorHourWib(data.anchorHourWib ?? 6);
    setEnabled(data.enabled !== false);
  }, []);

  const load = useCallback(async () => {
    const response = await fetch(appPath("/api/admin/settings/news"));
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Gagal memuat");
      return;
    }
    apply(data);
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const keywords = keywordsText
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    const response = await fetch(appPath("/api/admin/settings/news"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords,
        intervalHours,
        anchorHourWib,
        enabled,
      }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Gagal menyimpan");
      return;
    }
    apply(data);
    setMessage("Pengaturan berita tersimpan.");
  }

  async function refreshNow() {
    setLoading(true);
    setMessage("");
    const response = await fetch(appPath("/api/admin/settings/news"), {
      method: "POST",
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Refresh gagal");
      return;
    }
    apply(data);
    const r = data.result;
    setMessage(
      r
        ? `Refresh selesai — +${r.inserted} baru, ${r.skipped} dilewati${
            r.errors?.length ? `, ${r.errors.length} error` : ""
          }.`
        : "Refresh selesai.",
    );
  }

  if (!settings) {
    return (
      <p className="text-sm text-[var(--muted)]">Memuat pengaturan berita…</p>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
      <form onSubmit={save} className="panel space-y-4 rounded-3xl p-6">
        <h2 className="display text-3xl">Pembaruan berita</h2>
        <p className="text-sm text-[var(--muted)]">
          Atur kata kunci Google News RSS dan jadwal pembaruan hub{" "}
          <code className="text-[var(--ink)]">/berita</code>. Timer VPS
          memeriksa jadwal setiap jam (WIB).
        </p>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>Aktifkan pembaruan terjadwal</span>
        </label>

        <label className="block space-y-1 text-sm">
          <span>Kata kunci (satu per baris)</span>
          <textarea
            className="input min-h-[160px] font-mono text-sm"
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            placeholder={"osn ai\nosn informatika\ntoki"}
            required
          />
          <span className="text-xs text-[var(--muted)]">
            Maks. 30 kata kunci. Duplikat diabaikan (case-insensitive).
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span>Periode update</span>
            <select
              className="input"
              value={intervalHours}
              onChange={(e) => setIntervalHours(Number(e.target.value))}
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Jam acuan (WIB)</span>
            <select
              className="input"
              value={anchorHourWib}
              onChange={(e) => setAnchorHourWib(Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="rounded-xl border border-[var(--line)] bg-[rgba(255,252,246,0.5)] px-3 py-2 text-sm text-[var(--muted)]">
          Jadwal:{" "}
          <span className="font-medium text-[var(--ink)]">
            {settings.scheduleLabel ??
              INTERVAL_OPTIONS.find((o) => o.value === intervalHours)?.label}
          </span>
        </p>

        <div className="flex flex-wrap gap-3">
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Menyimpan…" : "Simpan"}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={loading}
            onClick={() => void refreshNow()}
          >
            Refresh sekarang
          </button>
        </div>
        {message ? (
          <p className="text-sm text-[var(--muted)]" role="status">
            {message}
          </p>
        ) : null}
      </form>

      <aside className="panel space-y-3 rounded-3xl p-6">
        <h3 className="text-lg font-semibold">Status</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Tersimpan</dt>
            <dd>{settings.configured ? "Ya" : "Default (belum disimpan)"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Kata kunci</dt>
            <dd>{settings.keywords.length}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Refresh terakhir</dt>
            <dd>{formatWib(settings.lastRefreshAt)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Hasil terakhir</dt>
            <dd>
              {settings.lastRefreshOk == null
                ? "—"
                : settings.lastRefreshOk
                  ? "OK"
                  : "Ada error"}
            </dd>
          </div>
        </dl>
        {settings.lastRefreshMessage ? (
          <p className="break-all rounded-xl border border-[var(--line)] px-3 py-2 font-mono text-xs text-[var(--muted)]">
            {settings.lastRefreshMessage}
          </p>
        ) : null}
        <p className="text-xs text-[var(--muted)]">
          Cuplikan hanya judul + ringkasan pendek; isi lengkap tetap di situs
          penerbit.
        </p>
      </aside>
    </div>
  );
}
