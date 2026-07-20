"use client";

import { FormEvent, useEffect, useState } from "react";

type SettingsState = {
  configured: boolean;
  baseUrl?: string;
  modelId?: string;
  lastTestOk?: boolean | null;
  lastTestedAt?: string | null;
  sharedAvailable?: boolean;
  effectiveSource?: "personal" | "admin" | "default" | null;
};

export function AiSettingsForm() {
  const [baseUrl, setBaseUrl] = useState("https://api.minimax.io/v1");
  const [modelId, setModelId] = useState("MiniMax-M3");
  const [apiKey, setApiKey] = useState("");
  const [info, setInfo] = useState<SettingsState | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/settings/ai");
    const data = await res.json();
    setInfo(data);
    if (data.baseUrl) setBaseUrl(data.baseUrl);
    if (data.modelId) setModelId(data.modelId);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          modelId,
          apiKey: apiKey || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      setApiKey("");
      setMessage("Tersimpan. Uji koneksi sebelum generate soal.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function test() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings/ai", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Tes gagal");
      setMessage("Koneksi berhasil.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    setLoading(true);
    await fetch("/api/settings/ai", { method: "DELETE" });
    setMessage("Kredensial dihapus.");
    await load();
    setLoading(false);
  }

  return (
    <form onSubmit={save} className="panel max-w-xl space-y-4 rounded-3xl p-6">
      <h1 className="display text-3xl">Pengaturan AI</h1>
      <p className="text-sm text-[var(--muted)]">
        {info?.sharedAvailable
          ? "Admin menyediakan LLM bersama. Kamu dapat langsung memakai AI, atau memasang BYOK untuk menggunakan providermu sendiri."
          : "Admin belum menyediakan LLM bersama. Masukkan endpoint OpenAI-compatible untuk memakai fitur AI."}{" "}
        API key pribadi dienkripsi di server dan tidak pernah dikirim balik ke
        browser.
      </p>
      {info?.effectiveSource && (
        <p className="rounded-2xl bg-[rgba(15,110,86,0.1)] px-4 py-3 text-sm text-[var(--accent)]">
          Provider aktif:{" "}
          <strong>
            {info.effectiveSource === "personal"
              ? "BYOK pribadi"
              : info.effectiveSource === "admin"
                ? "LLM admin"
                : "LLM bawaan (MiniMax M3)"}
          </strong>
        </p>
      )}
      <label className="block space-y-1 text-sm">
        <span>Base URL</span>
        <input
          className="input"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          required
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Model ID</span>
        <input
          className="input"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          required
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>
          API Key{" "}
          {info?.configured ? "(kosongkan jika tidak ingin mengganti)" : ""}
        </span>
        <input
          className="input"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={info?.configured ? "••••••••" : "sk-..."}
        />
      </label>
      {info?.configured && (
        <p className="text-xs text-[var(--muted)]">
          Status tes:{" "}
          {info.lastTestOk === true
            ? "OK"
            : info.lastTestOk === false
              ? "Gagal"
              : "Belum diuji"}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={loading} type="submit">
          Simpan
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={loading}
          onClick={test}
        >
          Uji koneksi
        </button>
        {info?.configured && (
          <button
            className="btn btn-secondary"
            type="button"
            disabled={loading}
            onClick={remove}
          >
            Hapus key
          </button>
        )}
      </div>
      {message && <p className="text-sm">{message}</p>}
    </form>
  );
}
