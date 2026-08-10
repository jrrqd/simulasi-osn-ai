"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type {
  IoaiDomain,
  IoaiResourceCategory,
  IoaiResourceRecord,
} from "@/lib/content/resource-types";

type TopicOption = { id: string; label: string; track?: string };

type FormState = {
  id: string;
  category: IoaiResourceCategory;
  title: string;
  url: string;
  summary: string;
  region: string;
  year: string;
  domains: IoaiDomain[];
  topics: string[];
  promptHint: string;
  hidden: boolean;
};

const EMPTY: FormState = {
  id: "",
  category: "national_olympiad",
  title: "",
  url: "",
  summary: "",
  region: "",
  year: "",
  domains: [],
  topics: [],
  promptHint: "",
  hidden: false,
};

const CATEGORY_LABELS: Record<IoaiResourceCategory, string> = {
  syllabus: "Silabus",
  task_repo: "Repo tugas",
  national_olympiad: "Olimpiade nasional",
  course: "Kursus",
};

function toForm(r: IoaiResourceRecord): FormState {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    url: r.url,
    summary: r.summary,
    region: r.region ?? "",
    year: r.year != null ? String(r.year) : "",
    domains: r.domains,
    topics: r.topics,
    promptHint: r.promptHint ?? "",
    hidden: r.hidden,
  };
}

function toggleIn<T extends string>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((x) => x !== value)
    : [...list, value];
}

function applyClientFilters(
  rows: IoaiResourceRecord[],
  opts: {
    q: string;
    categoryFilter: string;
    topicFilter: string;
    showHiddenOnly: boolean;
  },
) {
  let next = rows;
  if (opts.showHiddenOnly) next = next.filter((r) => r.hidden);
  if (opts.categoryFilter) {
    next = next.filter((r) => r.category === opts.categoryFilter);
  }
  if (opts.topicFilter) {
    next = next.filter((r) => r.topics.includes(opts.topicFilter));
  }
  const q = opts.q.trim().toLowerCase();
  if (q) {
    next = next.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        (r.region ?? "").toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
  }
  return next;
}

export function AdminResourceManager({
  initialResources,
  initialCategories,
  initialDomains,
  initialTopics,
  initialPreview,
  initialPreviewTopic,
}: {
  initialResources: IoaiResourceRecord[];
  initialCategories: IoaiResourceCategory[];
  initialDomains: IoaiDomain[];
  initialTopics: TopicOption[];
  initialPreview: string;
  initialPreviewTopic: string;
}) {
  const [allResources, setAllResources] =
    useState<IoaiResourceRecord[]>(initialResources);
  const [categories] = useState(initialCategories);
  const [domains] = useState(initialDomains);
  const [topicOptions] = useState(initialTopics);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);
  const [previewTopic, setPreviewTopic] = useState(initialPreviewTopic);
  const [preview, setPreview] = useState(initialPreview);
  const [previewLoading, setPreviewLoading] = useState(false);

  const resources = useMemo(
    () =>
      applyClientFilters(allResources, {
        q,
        categoryFilter,
        topicFilter,
        showHiddenOnly,
      }),
    [allResources, q, categoryFilter, topicFilter, showHiddenOnly],
  );

  async function reload() {
    const response = await fetch("/api/admin/resources");
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Gagal memuat referensi IOAI");
      return;
    }
    setAllResources(data.resources ?? []);
  }

  async function refreshPreview(topic: string) {
    setPreviewLoading(true);
    const params = new URLSearchParams({
      previewTopic: topic,
      phase: "final",
    });
    const response = await fetch(`/api/admin/resources?${params}`);
    const data = await response.json();
    setPreviewLoading(false);
    if (response.ok) setPreview(data.preview ?? "");
  }

  const visibleCount = useMemo(
    () => allResources.filter((r) => !r.hidden).length,
    [allResources],
  );

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setOpen(true);
    setMessage("");
  }

  function startEdit(row: IoaiResourceRecord) {
    setEditingId(row.id);
    setForm(toForm(row));
    setOpen(true);
    setMessage("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const payload = {
      id: editingId ?? undefined,
      category: form.category,
      title: form.title.trim(),
      url: form.url.trim(),
      summary: form.summary.trim(),
      region: form.region.trim() || null,
      year: form.year.trim() ? Number(form.year) : null,
      domains: form.domains,
      topics: form.topics,
      promptHint: form.promptHint.trim() || null,
      hidden: form.hidden,
    };

    const response = editingId
      ? await fetch("/api/admin/resources", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, id: editingId }),
        })
      : await fetch("/api/admin/resources", {
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
    setMessage(editingId ? "Referensi diperbarui." : "Referensi ditambahkan.");
    await reload();
    await refreshPreview(previewTopic);
  }

  async function toggleHidden(row: IoaiResourceRecord) {
    setLoading(true);
    const response = await fetch("/api/admin/resources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, hidden: !row.hidden }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Gagal mengubah visibilitas");
      return;
    }
    setMessage(row.hidden ? "Ditampilkan lagi." : "Disembunyikan dari siswa/LLM.");
    await reload();
    await refreshPreview(previewTopic);
  }

  async function remove(row: IoaiResourceRecord) {
    const confirmMsg =
      row.source === "admin"
        ? `Hapus permanen "${row.title}"?`
        : `Sembunyikan curated "${row.title}"? (tidak menghapus dari seed)`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    const response = await fetch(
      `/api/admin/resources?id=${encodeURIComponent(row.id)}`,
      { method: "DELETE" },
    );
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Gagal menghapus");
      return;
    }
    setMessage(
      data.deleted ? "Referensi admin dihapus." : "Curated disembunyikan.",
    );
    await reload();
    await refreshPreview(previewTopic);
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-2xl bg-white/70 px-3 py-2 text-sm">{message}</p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Cari</span>
          <input
            className="rounded-xl border border-[var(--line)] bg-white px-3 py-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="judul / region / id"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Kategori</span>
          <select
            className="rounded-xl border border-[var(--line)] bg-white px-3 py-2"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Semua</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] ?? c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Topik silabus</span>
          <select
            className="max-w-[220px] rounded-xl border border-[var(--line)] bg-white px-3 py-2"
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
          >
            <option value="">Semua</option>
            {topicOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={showHiddenOnly}
            onChange={(e) => setShowHiddenOnly(e.target.checked)}
          />
          Hanya yang disembunyikan
        </label>
        <button
          type="button"
          className="btn btn-primary ml-auto inline-flex items-center gap-2"
          onClick={startCreate}
        >
          <Plus size={16} />
          Tambah referensi
        </button>
      </div>

      <p className="text-sm text-[var(--muted)]">
        {resources.length} baris ditampilkan · {visibleCount} terlihat oleh
        siswa/LLM (dari {allResources.length} total). Perubahan langsung aktif —
        tidak perlu redeploy.
      </p>

      <div className="panel overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Judul</th>
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 font-medium">Region</th>
              <th className="px-4 py-3 font-medium">Topik</th>
              <th className="px-4 py-3 font-medium">Sumber</th>
              <th className="px-4 py-3 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {resources.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--line)]/60 last:border-0"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{row.title}</div>
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--accent)]"
                  >
                    buka <ExternalLink size={12} />
                  </a>
                  {row.hidden ? (
                    <span className="ml-2 text-xs text-[var(--muted)]">
                      (tersembunyi)
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {CATEGORY_LABELS[row.category] ?? row.category}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {[row.region, row.year].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--muted)]">
                  {row.topics.slice(0, 3).join(", ") || "—"}
                  {row.topics.length > 3 ? "…" : ""}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs">
                    {row.source}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="rounded-lg p-1.5 hover:bg-black/5"
                      title="Edit"
                      onClick={() => startEdit(row)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 hover:bg-black/5"
                      title={row.hidden ? "Tampilkan" : "Sembunyikan"}
                      onClick={() => void toggleHidden(row)}
                      disabled={loading}
                    >
                      {row.hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 hover:bg-black/5"
                      title={
                        row.source === "admin"
                          ? "Hapus permanen"
                          : "Sembunyikan curated"
                      }
                      onClick={() => void remove(row)}
                      disabled={loading}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {resources.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-[var(--muted)]"
                >
                  Tidak ada referensi untuk filter ini.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <section className="panel space-y-3 rounded-3xl p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Preview prompt LLM
          </p>
          <h2 className="display text-xl">Blok referensi untuk generate soal</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Seperti yang dikirim ke model saat fase final (maks 4 entri).
          </p>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Topik</span>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2"
              value={previewTopic}
              onChange={(e) => setPreviewTopic(e.target.value)}
            >
              {topicOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary !py-2 text-sm"
              disabled={previewLoading}
              onClick={() => void refreshPreview(previewTopic)}
            >
              {previewLoading ? "Memuat…" : "Refresh preview"}
            </button>
          </div>
        </label>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-black/[0.04] p-4 text-xs leading-relaxed">
          {preview || "(kosong — tidak ada matching resource)"}
        </pre>
      </section>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={save}
            className="panel max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-3xl p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="display text-2xl">
                  {editingId ? "Edit referensi" : "Tambah referensi"}
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Tautan Education Hub / olimpiade nasional untuk siswa &amp; LLM.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 hover:bg-black/5"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Judul</span>
              <input
                required
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">URL</span>
              <input
                required
                type="url"
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Kategori</span>
                <select
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                  value={form.category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category: e.target.value as IoaiResourceCategory,
                    })
                  }
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c] ?? c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Region</span>
                <input
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  placeholder="NEOAI, Poland…"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Tahun</span>
                <input
                  type="number"
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  placeholder="2025"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">
                Ringkasan (≤200 karakter)
              </span>
              <textarea
                required
                maxLength={200}
                rows={3}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">
                Prompt hint (opsional, hanya LLM)
              </span>
              <textarea
                maxLength={500}
                rows={2}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                value={form.promptHint}
                onChange={(e) =>
                  setForm({ ...form, promptHint: e.target.value })
                }
              />
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm text-[var(--muted)]">Domain</legend>
              <div className="flex flex-wrap gap-2">
                {domains.map((d) => (
                  <label
                    key={d}
                    className={`cursor-pointer rounded-full px-3 py-1 text-xs ${
                      form.domains.includes(d)
                        ? "bg-[var(--accent)] text-white"
                        : "bg-black/5"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.domains.includes(d)}
                      onChange={() =>
                        setForm({
                          ...form,
                          domains: toggleIn(form.domains, d),
                        })
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm text-[var(--muted)]">
                Topik silabus
              </legend>
              <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                {topicOptions.map((t) => (
                  <label
                    key={t.id}
                    className={`cursor-pointer rounded-full px-3 py-1 text-xs ${
                      form.topics.includes(t.id)
                        ? "bg-[var(--accent)] text-white"
                        : "bg-black/5"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.topics.includes(t.id)}
                      onChange={() =>
                        setForm({
                          ...form,
                          topics: toggleIn(form.topics, t.id),
                        })
                      }
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.hidden}
                onChange={(e) =>
                  setForm({ ...form, hidden: e.target.checked })
                }
              />
              Sembunyikan dari siswa &amp; LLM
            </label>

            <div className="flex justify-end gap-2 pt-2">
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
