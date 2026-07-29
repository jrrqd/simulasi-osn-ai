"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { DIFFICULTY_MODES, type DifficultyMode } from "@/lib/ai/difficulty";
import { TRACKS, type TrackId } from "@/lib/content/types";

type ListItem = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  problemCount: number;
  track: string;
  difficultyMode: string;
  kind: string;
  source: "curated" | "ai";
  hidden: boolean;
  updatedAt?: string;
};

type MockForm = {
  id?: string;
  title: string;
  description: string;
  durationMinutes: number;
  problemIdsText: string;
  track: TrackId;
  difficultyMode: DifficultyMode;
  kind: "ai" | "curated_assembled";
  penaltyEnabled: boolean;
  penaltyMinutesPerWrong: number;
};

const EMPTY_FORM: MockForm = {
  title: "",
  description: "",
  durationMinutes: 60,
  problemIdsText: "",
  track: "B",
  difficultyMode: "medium",
  kind: "ai",
  penaltyEnabled: true,
  penaltyMinutesPerWrong: 1,
};

function toForm(mock: Record<string, unknown>): MockForm {
  const track =
    (String(mock.track || "B") as TrackId) in TRACKS
      ? (String(mock.track) as TrackId)
      : "B";
  const problemIds = Array.isArray(mock.problemIds)
    ? mock.problemIds.map(String)
    : [];
  const mode = String(mock.difficultyMode || "medium");
  const difficultyMode = (
    ["easy", "medium", "hard"].includes(mode) ? mode : "medium"
  ) as DifficultyMode;
  const kind =
    mock.kind === "curated_assembled" ? "curated_assembled" : "ai";
  return {
    id: String(mock.id || ""),
    title: String(mock.title || ""),
    description: String(mock.description || ""),
    durationMinutes: Number(mock.durationMinutes) || 60,
    problemIdsText: problemIds.join("\n"),
    track,
    difficultyMode,
    kind,
    penaltyEnabled: mock.penaltyEnabled !== false,
    penaltyMinutesPerWrong: Number(mock.penaltyMinutesPerWrong) || 1,
  };
}

function formPayload(form: MockForm) {
  const problemIds = form.problemIdsText
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    durationMinutes: form.durationMinutes,
    problemIds,
    track: form.track,
    difficultyMode: form.difficultyMode,
    kind: form.kind,
    penaltyEnabled: form.penaltyEnabled,
    penaltyMinutesPerWrong: form.penaltyMinutesPerWrong,
  };
}

export function AdminMockManager() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | "curated" | "ai">("all");
  const [includeHidden, setIncludeHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<MockForm>(EMPTY_FORM);
  const [formSource, setFormSource] = useState<"curated" | "ai" | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (source !== "all") params.set("source", source);
    if (includeHidden) params.set("includeHidden", "1");
    params.set("limit", "120");
    const res = await fetch(`/api/admin/mocks?${params}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [query, source, includeHidden]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openEdit(item: ListItem) {
    setMessage("");
    const res = await fetch(
      `/api/admin/mocks?id=${encodeURIComponent(item.id)}`,
    );
    const data = await res.json();
    if (!res.ok || !data.mock) {
      setMessage(data.error || "Gagal memuat simulasi");
      return;
    }
    setForm(toForm(data.mock));
    setFormSource(data.source ?? item.source);
    setCreating(false);
    setEditing(true);
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setFormSource("ai");
    setCreating(true);
    setEditing(true);
    setMessage("");
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const payload = formPayload(form);
      if (payload.problemIds.length < 1) {
        throw new Error("Minimal 1 problemId (satu baris per id)");
      }
      const res = await fetch("/api/admin/mocks", {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          creating ? payload : { ...payload, id: form.id },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      setMessage(creating ? "Simulasi dibuat." : "Simulasi diperbarui.");
      setEditing(false);
      setCreating(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function hideItem(item: ListItem) {
    if (
      !window.confirm(
        `Sembunyikan "${item.title}" dari bank Simulasi siswa?`,
      )
    ) {
      return;
    }
    const res = await fetch(
      `/api/admin/mocks?id=${encodeURIComponent(item.id)}`,
      { method: "DELETE" },
    );
    const data = await res.json();
    setMessage(
      res.ok
        ? "Simulasi disembunyikan dari daftar siswa."
        : data.error || "Gagal menyembunyikan",
    );
    if (res.ok) await load();
  }

  async function unhideItem(item: ListItem) {
    const res = await fetch("/api/admin/mocks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, restore: true }),
    });
    const data = await res.json();
    setMessage(
      res.ok
        ? "Simulasi ditampilkan lagi."
        : data.error || "Gagal memulihkan",
    );
    if (res.ok) await load();
  }

  async function deletePermanent(item: ListItem) {
    if (item.source !== "ai") return;
    if (
      !window.confirm(
        `Hapus PERMANEN simulasi AI "${item.title}"? Tidak bisa dibatalkan.`,
      )
    ) {
      return;
    }
    const res = await fetch(
      `/api/admin/mocks?id=${encodeURIComponent(item.id)}&permanent=1`,
      { method: "DELETE" },
    );
    const data = await res.json();
    setMessage(
      res.ok ? "Simulasi AI dihapus permanen." : data.error || "Gagal",
    );
    if (res.ok) await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <input
          className="input max-w-xs"
          placeholder="Cari judul / id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="select max-w-[10rem]"
          value={source}
          onChange={(e) =>
            setSource(e.target.value as "all" | "curated" | "ai")
          }
        >
          <option value="all">Semua sumber</option>
          <option value="curated">Curated</option>
          <option value="ai">AI / assembled</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent)]"
            checked={includeHidden}
            onChange={(e) => setIncludeHidden(e.target.checked)}
          />
          Tampilkan tersembunyi
        </label>
        <button
          className="btn btn-primary ml-auto"
          type="button"
          onClick={openCreate}
        >
          <Plus size={17} />
          Buat simulasi
        </button>
      </div>

      <p className="text-sm text-[var(--muted)]">
        {loading ? "Memuat…" : `${total} paket`} · sembunyikan = hilang dari
        Simulasi siswa; AI bisa dihapus permanen terpisah. Centang &quot;Tampilkan
        tersembunyi&quot; untuk pulihkan.
      </p>

      {message ? (
        <p className="rounded-xl bg-white/70 px-3 py-2 text-sm">{message}</p>
      ) : null}

      <div className="panel overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-white/40">
            <tr>
              {[
                "Paket",
                "Sumber",
                "Durasi",
                "Soal",
                "Track",
                "Kind",
                "Aksi",
              ].map((label) => (
                <th key={label} className="px-4 py-3 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={`${item.source}-${item.id}`}
                className={`border-b border-[var(--line)]/70 ${
                  item.hidden ? "opacity-55" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{item.title}</p>
                  <p className="line-clamp-1 text-xs text-[var(--muted)]">
                    {item.id}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.source === "curated"
                        ? "bg-[rgba(15,110,86,0.12)] text-[var(--accent)]"
                        : "bg-[rgba(196,92,38,0.12)] text-[var(--accent-2)]"
                    }`}
                  >
                    {item.source === "curated" ? "Curated" : "AI"}
                  </span>
                  {item.hidden ? (
                    <span className="ml-1 text-xs text-[var(--muted)]">
                      · hidden
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{item.durationMinutes} mnt</td>
                <td className="px-4 py-3">{item.problemCount}</td>
                <td className="px-4 py-3">{item.track}</td>
                <td className="px-4 py-3 text-xs">{item.kind}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="btn btn-secondary !px-2.5 !py-1"
                      onClick={() => void openEdit(item)}
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    {item.hidden ? (
                      <button
                        type="button"
                        className="btn btn-secondary !px-2.5 !py-1"
                        onClick={() => void unhideItem(item)}
                        title="Tampilkan lagi di Simulasi"
                      >
                        <Eye size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary !px-2.5 !py-1"
                        onClick={() => void hideItem(item)}
                        title="Sembunyikan dari Simulasi"
                      >
                        <EyeOff size={14} />
                      </button>
                    )}
                    {item.source === "ai" ? (
                      <button
                        type="button"
                        className="btn btn-secondary !px-2.5 !py-1 text-[var(--bad)]"
                        onClick={() => void deletePermanent(item)}
                        title="Hapus permanen"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-[var(--muted)]"
                >
                  Tidak ada simulasi.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/35 p-4 backdrop-blur-[2px]">
          <form
            onSubmit={onSave}
            className="panel relative my-6 w-full max-w-2xl space-y-4 rounded-3xl p-5 shadow-[0_20px_60px_rgba(28,36,48,0.25)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                  {creating ? "Buat simulasi" : "Edit simulasi"}
                  {formSource ? ` · ${formSource}` : ""}
                </p>
                <h2 className="display text-2xl">
                  {creating ? "Paket baru" : form.title || form.id}
                </h2>
                {!creating && formSource === "curated" ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Perubahan curated disimpan sebagai overlay DB.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-full p-2 hover:bg-black/5"
                onClick={() => {
                  setEditing(false);
                  setCreating(false);
                }}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <input
              className="input"
              placeholder="Judul paket"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              required
            />
            <textarea
              className="textarea min-h-[72px]"
              placeholder="Deskripsi"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />

            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="input"
                type="number"
                min={5}
                max={300}
                placeholder="Durasi (menit)"
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    durationMinutes: Number(e.target.value) || 60,
                  }))
                }
                required
              />
              <select
                className="select"
                value={form.track}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    track: e.target.value as TrackId,
                  }))
                }
              >
                {Object.entries(TRACKS).map(([id, meta]) => (
                  <option key={id} value={id}>
                    {id}. {meta.name}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={form.difficultyMode}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    difficultyMode: e.target.value as DifficultyMode,
                  }))
                }
              >
                {DIFFICULTY_MODES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kind: e.target.value as "ai" | "curated_assembled",
                  }))
                }
                disabled={formSource === "curated"}
              >
                <option value="ai">ai</option>
                <option value="curated_assembled">curated_assembled</option>
              </select>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-white/50 p-4 space-y-3">
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.penaltyEnabled}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      penaltyEnabled: e.target.checked,
                    }))
                  }
                />
                Enable submission penalty (tie-breaker ICPC)
              </label>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <label className="text-sm text-[var(--muted)]">
                  Menit penalti per wrong answer (tie-breaker)
                </label>
                <input
                  className="input w-28"
                  type="number"
                  min={0}
                  max={120}
                  disabled={!form.penaltyEnabled}
                  value={form.penaltyMinutesPerWrong}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      penaltyMinutesPerWrong: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Problem IDs (satu per baris)
              </label>
              <textarea
                className="textarea min-h-[160px] font-mono text-sm"
                placeholder={"p-a-mean-1\np-b-mse\nai-xxxxx"}
                value={form.problemIdsText}
                onChange={(e) =>
                  setForm((f) => ({ ...f, problemIdsText: e.target.value }))
                }
                required
              />
              <p className="text-xs text-[var(--muted)]">
                Ambil id dari Bank soal admin. Urutan baris = urutan soal di
                paket.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditing(false);
                  setCreating(false);
                }}
              >
                Batal
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving}
              >
                {saving ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
