"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { BookOpen, ExternalLink, Pencil, X } from "lucide-react";
import type {
  IoaiGuideRecord,
  IoaiResourceRecord,
} from "@/lib/content/resource-types";

type GuideForm = {
  id: string;
  title: string;
  ringkasan: string;
  kunciJawaban: string;
  pembahasan: string;
  originalUrl: string;
  solutionUrl: string;
  credit: string;
  topics: string;
  hidden: boolean;
};

function toForm(guide: IoaiGuideRecord): GuideForm {
  return {
    id: guide.id,
    title: guide.title,
    ringkasan: guide.ringkasan,
    kunciJawaban: guide.kunciJawaban,
    pembahasan: guide.pembahasan,
    originalUrl: guide.originalUrl,
    solutionUrl: guide.solutionUrl ?? "",
    credit: guide.credit,
    topics: guide.topics.join(", "),
    hidden: guide.hidden,
  };
}

export function AdminResourcesManager() {
  const [resources, setResources] = useState<IoaiResourceRecord[]>([]);
  const [guides, setGuides] = useState<IoaiGuideRecord[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<GuideForm | null>(null);

  const load = useCallback(async () => {
    const [resResources, resGuides] = await Promise.all([
      fetch("/api/admin/resources"),
      fetch("/api/admin/guides"),
    ]);
    const dataResources = await resResources.json();
    const dataGuides = await resGuides.json();
    if (!resResources.ok) {
      setMessage(dataResources.error || "Gagal memuat resources");
      return;
    }
    if (!resGuides.ok) {
      setMessage(dataGuides.error || "Gagal memuat panduan");
      return;
    }
    setResources(dataResources.resources ?? []);
    setGuides(dataGuides.guides ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const guideByResource = new Map(guides.map((g) => [g.resourceId, g]));

  function startEdit(guide: IoaiGuideRecord) {
    setForm(toForm(guide));
    setMessage("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/guides", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          title: form.title,
          ringkasan: form.ringkasan,
          kunciJawaban: form.kunciJawaban,
          pembahasan: form.pembahasan,
          originalUrl: form.originalUrl,
          solutionUrl: form.solutionUrl || null,
          credit: form.credit,
          topics: form.topics
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          hidden: form.hidden,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Gagal menyimpan");
        return;
      }
      setMessage("Panduan tersimpan.");
      setForm(null);
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function toggleResourceHidden(id: string, hidden: boolean) {
    setMessage("");
    const response = await fetch("/api/admin/resources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, hidden }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Gagal mengubah status");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-5">
      {message ? (
        <p className="rounded-2xl bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent)]">
          {message}
        </p>
      ) : null}

      {form ? (
        <form
          onSubmit={save}
          className="panel space-y-3 rounded-3xl border border-[var(--line)] p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                Edit panduan ID
              </p>
              <h2 className="display text-2xl">{form.id}</h2>
            </div>
            <button
              type="button"
              className="btn btn-secondary !py-1.5"
              onClick={() => setForm(null)}
            >
              <X size={14} />
            </button>
          </div>
          <label className="block space-y-1 text-sm">
            <span>Judul</span>
            <input
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Ringkasan (markdown)</span>
            <textarea
              className="min-h-36 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-mono text-xs"
              value={form.ringkasan}
              onChange={(e) => setForm({ ...form, ringkasan: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Kunci jawaban (markdown)</span>
            <textarea
              className="min-h-36 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-mono text-xs"
              value={form.kunciJawaban}
              onChange={(e) =>
                setForm({ ...form, kunciJawaban: e.target.value })
              }
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Pembahasan (markdown)</span>
            <textarea
              className="min-h-36 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-mono text-xs"
              value={form.pembahasan}
              onChange={(e) =>
                setForm({ ...form, pembahasan: e.target.value })
              }
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span>URL soal asli</span>
              <input
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                value={form.originalUrl}
                onChange={(e) =>
                  setForm({ ...form, originalUrl: e.target.value })
                }
                required
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>URL solusi resmi</span>
              <input
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                value={form.solutionUrl}
                onChange={(e) =>
                  setForm({ ...form, solutionUrl: e.target.value })
                }
              />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span>Kredit</span>
            <input
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
              value={form.credit}
              onChange={(e) => setForm({ ...form, credit: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Topik (pisah koma)</span>
            <input
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
              value={form.topics}
              onChange={(e) => setForm({ ...form, topics: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hidden}
              onChange={(e) => setForm({ ...form, hidden: e.target.checked })}
            />
            Sembunyikan panduan
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "Menyimpan…" : "Simpan panduan"}
          </button>
        </form>
      ) : null}

      <div className="space-y-3">
        {resources.map((resource) => {
          const guide = guideByResource.get(resource.id);
          return (
            <div
              key={resource.id}
              className="panel flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {resource.category}
                    {resource.year ? ` · ${resource.year}` : ""}
                  </span>
                  {guide ? (
                    <span className="rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                      Punya panduan ID
                    </span>
                  ) : null}
                  {resource.hidden ? (
                    <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                      Hidden
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-medium">{resource.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {resource.summary}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {guide ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary inline-flex items-center gap-1.5 !py-1.5 text-sm"
                      onClick={() => startEdit(guide)}
                    >
                      <Pencil size={14} />
                      Edit panduan
                    </button>
                    <Link
                      href={`/resources/ioai/${guide.id}`}
                      className="btn btn-secondary inline-flex items-center gap-1.5 !py-1.5 text-sm"
                    >
                      <BookOpen size={14} />
                      Lihat
                    </Link>
                  </>
                ) : null}
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary inline-flex items-center gap-1.5 !py-1.5 text-sm"
                >
                  <ExternalLink size={14} />
                  Asli
                </a>
                <button
                  type="button"
                  className="btn btn-secondary !py-1.5 text-sm"
                  onClick={() =>
                    void toggleResourceHidden(resource.id, !resource.hidden)
                  }
                >
                  {resource.hidden ? "Tampilkan" : "Sembunyikan"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
