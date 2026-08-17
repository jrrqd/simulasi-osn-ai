"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";

type Phase = {
  id: string;
  label: string;
  dateLabel: string;
  at: string;
  endsAt: string | null;
  sortOrder: number;
  enabled: boolean;
};

type FormState = {
  id: string;
  label: string;
  dateLabel: string;
  at: string;
  endsAt: string;
  sortOrder: string;
  enabled: boolean;
};

const EMPTY: FormState = {
  id: "",
  label: "",
  dateLabel: "",
  at: "",
  endsAt: "",
  sortOrder: "0",
  enabled: true,
};

function toForm(phase: Phase): FormState {
  return {
    id: phase.id,
    label: phase.label,
    dateLabel: phase.dateLabel,
    at: phase.at,
    endsAt: phase.endsAt ?? "",
    sortOrder: String(phase.sortOrder),
    enabled: phase.enabled,
  };
}

export function AdminCountdownPhases() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/countdown-phases");
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Gagal memuat fase");
      return;
    }
    setPhases(data.phases ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setOpen(true);
    setMessage("");
  }

  function startEdit(phase: Phase) {
    setEditingId(phase.id);
    setForm(toForm(phase));
    setOpen(true);
    setMessage("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const payload = {
      id: form.id.trim() || undefined,
      label: form.label.trim(),
      dateLabel: form.dateLabel.trim(),
      at: form.at.trim(),
      endsAt: form.endsAt.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      enabled: form.enabled,
    };

    const response = editingId
      ? await fetch(`/api/admin/countdown-phases/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/admin/countdown-phases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Gagal menyimpan");
      return;
    }
    setOpen(false);
    setMessage(editingId ? "Fase diperbarui." : "Fase ditambahkan.");
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm("Hapus fase countdown ini?")) return;
    setLoading(true);
    setMessage("");
    const response = await fetch(`/api/admin/countdown-phases/${id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Gagal menghapus");
      return;
    }
    setMessage("Fase dihapus.");
    if (editingId === id) setOpen(false);
    await load();
  }

  async function seedDefaults() {
    if (
      !window.confirm(
        "Muat 5 fase default resmi ke database? Hanya bisa jika daftar masih kosong.",
      )
    ) {
      return;
    }
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/admin/countdown-phases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seedDefaults: true }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Gagal memuat default");
      return;
    }
    setMessage(`Default resmi dimuat (${data.seeded} fase).`);
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={startCreate}>
          <Plus size={16} className="mr-1 inline" />
          Tambah fase
        </button>
        {phases.length === 0 ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void seedDefaults()}
            disabled={loading}
          >
            Muat default resmi
          </button>
        ) : null}
        {message ? (
          <p className="text-sm text-[var(--muted)]">{message}</p>
        ) : null}
      </div>

      {phases.length === 0 ? (
        <div className="panel rounded-3xl p-6 text-sm text-[var(--muted)]">
          Belum ada fase di database. Landing page memakai fallback bawaan sampai
          Anda menambah fase atau memuat default resmi.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-[var(--line)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white/40 text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Urutan</th>
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium">Tampilan</th>
                <th className="px-4 py-3 font-medium">Mulai (ISO)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {phases.map((phase) => (
                <tr
                  key={phase.id}
                  className="border-t border-[var(--line)] align-top"
                >
                  <td className="px-4 py-3">{phase.sortOrder}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{phase.label}</div>
                    <div className="text-xs text-[var(--muted)]">{phase.id}</div>
                  </td>
                  <td className="px-4 py-3">{phase.dateLabel}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <div>{phase.at}</div>
                    {phase.endsAt ? (
                      <div className="text-[var(--muted)]">→ {phase.endsAt}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {phase.enabled ? "Aktif" : "Nonaktif"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary !px-2.5 !py-1"
                        onClick={() => startEdit(phase)}
                        aria-label="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary !px-2.5 !py-1 text-[var(--bad)]"
                        onClick={() => void remove(phase.id)}
                        aria-label="Hapus"
                        disabled={loading}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={save}
            className="panel max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="display text-3xl">
                  {editingId ? "Edit fase" : "Fase baru"}
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Waktu pakai ISO dengan zona WIB, contoh{" "}
                  <code className="text-xs">2026-07-30T00:00:00+07:00</code>
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary !px-2.5 !py-1"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            {!editingId ? (
              <label className="block space-y-1 text-sm">
                <span>ID (opsional, slug)</span>
                <input
                  className="input"
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  placeholder="pra-seleksi"
                />
              </label>
            ) : null}

            <label className="block space-y-1 text-sm">
              <span>Label</span>
              <input
                className="input"
                required
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span>Tanggal tampilan</span>
              <input
                className="input"
                required
                value={form.dateLabel}
                onChange={(e) =>
                  setForm({ ...form, dateLabel: e.target.value })
                }
                placeholder="30 Juli 2026"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span>Mulai (ISO)</span>
              <input
                className="input font-mono text-sm"
                required
                value={form.at}
                onChange={(e) => setForm({ ...form, at: e.target.value })}
                placeholder="2026-07-30T00:00:00+07:00"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span>Selesai (ISO, opsional — untuk jendela multi-hari)</span>
              <input
                className="input font-mono text-sm"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                placeholder="2026-09-21T00:00:00+07:00"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-sm">
                <span>Urutan</span>
                <input
                  className="input"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({ ...form, sortOrder: e.target.value })
                  }
                />
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) =>
                    setForm({ ...form, enabled: e.target.checked })
                  }
                />
                <span>Aktif di landing</span>
              </label>
            </div>

            {message && open ? (
              <p className="text-sm text-red-700">{message}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setOpen(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
