"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type SharedSettings = {
  configured: boolean;
  enabled: boolean;
  baseUrl?: string;
  modelId?: string;
  lastTestOk?: boolean | null;
  lastTestedAt?: string | null;
};

export function AdminAiSettings() {
  const [settings, setSettings] = useState<SharedSettings | null>(null);
  const [baseUrl, setBaseUrl] = useState("https://api.minimax.io/v1");
  const [modelId, setModelId] = useState("MiniMax-M3");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/settings/ai");
    const data = await response.json();
    setSettings(data);
    if (data.baseUrl) setBaseUrl(data.baseUrl);
    if (data.modelId) setModelId(data.modelId);
    if (typeof data.enabled === "boolean") setEnabled(data.enabled);
  }, []);

  useEffect(() => {
    fetch("/api/admin/settings/ai")
      .then((response) => response.json())
      .then((data) => {
        setSettings(data);
        if (data.baseUrl) setBaseUrl(data.baseUrl);
        if (data.modelId) setModelId(data.modelId);
        if (typeof data.enabled === "boolean") setEnabled(data.enabled);
      });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/admin/settings/ai", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl,
        modelId,
        apiKey: apiKey || undefined,
        enabled,
      }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Gagal menyimpan");
      return;
    }
    setApiKey("");
    setMessage("Konfigurasi tersimpan. Jalankan uji koneksi.");
    await load();
  }

  async function test() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/admin/settings/ai", { method: "POST" });
    const data = await response.json();
    setLoading(false);
    setMessage(
      response.ok ? "Koneksi berhasil. LLM siap dipakai siswa." : data.error,
    );
    await load();
  }

  async function remove() {
    if (!window.confirm("Hapus API key bersama?")) return;
    setLoading(true);
    await fetch("/api/admin/settings/ai", { method: "DELETE" });
    setLoading(false);
    setMessage("Konfigurasi dihapus.");
    await load();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
      <form onSubmit={save} className="panel space-y-4 rounded-3xl p-6">
        <h2 className="display text-3xl">Provider bersama</h2>
        <p className="text-sm text-[var(--muted)]">
          Provider ini menjadi fallback bagi siswa yang tidak memasang BYOK.
          API key disimpan terenkripsi dan tidak pernah dikirim ke browser.
        </p>
        <label className="block space-y-1 text-sm">
          <span>Base URL</span>
          <input
            className="input"
            required
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Model ID</span>
          <input
            className="input"
            required
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>
            API Key{" "}
            {settings?.configured ? "(kosongkan untuk mempertahankan)" : ""}
          </span>
          <input
            className="input"
            type="password"
            placeholder={settings?.configured ? "••••••••" : "sk-..."}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/50 px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Izinkan siswa menggunakan provider bersama
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={loading}>
            Simpan
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={test}
            disabled={loading || !settings?.configured}
          >
            Uji koneksi
          </button>
          {settings?.configured && (
            <button
              type="button"
              className="btn btn-secondary text-[var(--bad)]"
              onClick={remove}
              disabled={loading}
            >
              Hapus
            </button>
          )}
        </div>
        {message && <p className="text-sm">{message}</p>}
      </form>

      <aside className="panel h-fit rounded-3xl p-5">
        <h3 className="display text-2xl">Status</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt>Konfigurasi</dt>
            <dd>{settings?.configured ? "Tersimpan" : "Belum ada"}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Akses siswa</dt>
            <dd>{settings?.enabled ? "Aktif" : "Nonaktif"}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Uji terakhir</dt>
            <dd>
              {settings?.lastTestOk === true
                ? "Berhasil"
                : settings?.lastTestOk === false
                  ? "Gagal"
                  : "Belum diuji"}
            </dd>
          </div>
        </dl>
        <p className="mt-5 text-xs leading-relaxed text-[var(--muted)]">
          Prioritas: BYOK siswa digunakan lebih dulu. Jika tidak tersedia atau
          belum lulus tes, aplikasi menggunakan provider bersama ini.
        </p>
      </aside>
    </div>
  );
}
