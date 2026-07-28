"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { TRACKS, TOPIC_LABELS, type TrackId } from "@/lib/content/types";

type ListItem = {
  id: string;
  title: string;
  track: string;
  topic: string;
  difficulty: number;
  answerType: string;
  source: "curated" | "ai";
  hidden: boolean;
  updatedAt?: string;
};

type ProblemForm = {
  id?: string;
  title: string;
  track: TrackId;
  topic: string;
  difficulty: number;
  answerType: "numeric" | "short_string" | "mcq" | "python_output" | "codeSpec";
  stem: string;
  answer: string;
  tolerance: string;
  choicesText: string;
  solution: string;
  starterCode: string;
};

const EMPTY_FORM: ProblemForm = {
  title: "",
  track: "B",
  topic: TRACKS.B.topics[0]!,
  difficulty: 2,
  answerType: "numeric",
  stem: "",
  answer: "",
  tolerance: "0",
  choicesText: "",
  solution: "",
  starterCode: "",
};

function toForm(problem: Record<string, unknown>): ProblemForm {
  const track = (String(problem.track || "B") as TrackId) in TRACKS
    ? (String(problem.track) as TrackId)
    : "B";
  const topics = TRACKS[track].topics;
  const topic = topics.includes(String(problem.topic))
    ? String(problem.topic)
    : topics[0]!;
  const choices = Array.isArray(problem.choices)
    ? problem.choices.map(String)
    : [];
  return {
    id: String(problem.id || ""),
    title: String(problem.title || ""),
    track,
    topic,
    difficulty: Number(problem.difficulty) || 2,
    answerType: (["numeric", "short_string", "mcq", "python_output", "codeSpec"].includes(
      String(problem.answerType),
    )
      ? String(problem.answerType)
      : "numeric") as ProblemForm["answerType"],
    stem: String(problem.stem || ""),
    answer: Array.isArray(problem.answer)
      ? problem.answer.join(", ")
      : String(problem.answer ?? ""),
    tolerance:
      problem.tolerance == null ? "0" : String(problem.tolerance),
    choicesText: choices.join("\n"),
    solution: String(problem.solution || ""),
    starterCode: String(problem.starterCode || ""),
  };
}

function formToPayload(form: ProblemForm) {
  const choices =
    form.answerType === "mcq"
      ? form.choicesText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
  const tolerance =
    form.answerType === "numeric" && form.tolerance.trim() !== ""
      ? Number(form.tolerance)
      : undefined;
  return {
    title: form.title.trim(),
    track: form.track,
    topic: form.topic,
    difficulty: form.difficulty,
    answerType: form.answerType,
    stem: form.stem.trim(),
    answer: form.answer.trim(),
    tolerance,
    choices,
    solution: form.solution.trim(),
    starterCode: form.starterCode.trim() || undefined,
  };
}

export function AdminProblemManager() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState<"" | TrackId>("");
  const [source, setSource] = useState<"all" | "curated" | "ai">("all");
  const [includeHidden, setIncludeHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ProblemForm>(EMPTY_FORM);
  const [formSource, setFormSource] = useState<"curated" | "ai" | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (track) params.set("track", track);
    if (source !== "all") params.set("source", source);
    if (includeHidden) params.set("includeHidden", "1");
    params.set("limit", "120");
    const res = await fetch(`/api/admin/problems?${params}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [query, track, source, includeHidden]);

  useEffect(() => {
    void load();
  }, [load]);

  const topicsForForm = useMemo(
    () => TRACKS[form.track].topics,
    [form.track],
  );

  async function openEdit(item: ListItem) {
    setMessage("");
    const res = await fetch(
      `/api/admin/problems?id=${encodeURIComponent(item.id)}`,
    );
    const data = await res.json();
    if (!res.ok || !data.problem) {
      setMessage(data.error || "Gagal memuat soal");
      return;
    }
    setForm(toForm(data.problem));
    setFormSource(data.source ?? item.source);
    setCreating(false);
    setEditing(true);
    setPreview(false);
  }

  function openCreate() {
    setForm({
      ...EMPTY_FORM,
      track: track || "B",
      topic: TRACKS[(track || "B") as TrackId].topics[0]!,
    });
    setFormSource("ai");
    setCreating(true);
    setEditing(true);
    setPreview(false);
    setMessage("");
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const payload = formToPayload(form);
      if (!payload.title || payload.stem.length < 10 || payload.solution.length < 10) {
        throw new Error("Judul, stem (≥10), dan solusi (≥10) wajib diisi");
      }
      if (payload.answerType === "mcq" && (payload.choices?.length ?? 0) < 2) {
        throw new Error("MCQ butuh minimal 2 pilihan (satu baris per pilihan)");
      }

      const res = await fetch("/api/admin/problems", {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          creating ? payload : { ...payload, id: form.id },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      setMessage(creating ? "Soal dibuat." : "Soal diperbarui.");
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
        `Sembunyikan "${item.title}" dari bank Latihan siswa?`,
      )
    ) {
      return;
    }
    const res = await fetch(
      `/api/admin/problems?id=${encodeURIComponent(item.id)}`,
      { method: "DELETE" },
    );
    const data = await res.json();
    setMessage(
      res.ok
        ? "Soal disembunyikan dari Latihan."
        : data.error || "Gagal menyembunyikan",
    );
    if (res.ok) await load();
  }

  async function unhideItem(item: ListItem) {
    const res = await fetch("/api/admin/problems", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, restore: true }),
    });
    const data = await res.json();
    setMessage(
      res.ok
        ? "Soal ditampilkan lagi di Latihan."
        : data.error || "Gagal memulihkan",
    );
    if (res.ok) await load();
  }

  async function deletePermanent(item: ListItem) {
    if (item.source !== "ai") return;
    if (
      !window.confirm(
        `Hapus PERMANEN soal AI "${item.title}"? Tidak bisa dibatalkan.`,
      )
    ) {
      return;
    }
    const res = await fetch(
      `/api/admin/problems?id=${encodeURIComponent(item.id)}&permanent=1`,
      { method: "DELETE" },
    );
    const data = await res.json();
    setMessage(res.ok ? "Soal AI dihapus permanen." : data.error || "Gagal");
    if (res.ok) await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <input
          className="input max-w-xs"
          placeholder="Cari judul / id / topic…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="select max-w-[10rem]"
          value={track}
          onChange={(e) => setTrack(e.target.value as "" | TrackId)}
        >
          <option value="">Semua track</option>
          {Object.entries(TRACKS).map(([id, meta]) => (
            <option key={id} value={id}>
              {id}. {meta.name}
            </option>
          ))}
        </select>
        <select
          className="select max-w-[10rem]"
          value={source}
          onChange={(e) =>
            setSource(e.target.value as "all" | "curated" | "ai")
          }
        >
          <option value="all">Semua sumber</option>
          <option value="curated">Curated</option>
          <option value="ai">AI</option>
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
        <button className="btn btn-primary ml-auto" type="button" onClick={openCreate}>
          <Plus size={17} />
          Buat soal
        </button>
      </div>

      <p className="text-sm text-[var(--muted)]">
        {loading ? "Memuat…" : `${total} soal`} · sembunyikan = hilang dari
        Latihan siswa; AI bisa dihapus permanen terpisah. Centang &quot;Tampilkan
        tersembunyi&quot; untuk pulihkan.
      </p>

      {message ? (
        <p className="rounded-xl bg-white/70 px-3 py-2 text-sm">{message}</p>
      ) : null}

      <div className="panel overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-white/40">
            <tr>
              {["Soal", "Sumber", "Track", "Topic", "Tipe", "Aksi"].map(
                (label) => (
                  <th key={label} className="px-4 py-3 font-semibold">
                    {label}
                  </th>
                ),
              )}
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
                  <p className="text-xs text-[var(--muted)]">{item.id}</p>
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
                <td className="px-4 py-3">{item.track}</td>
                <td className="px-4 py-3">
                  {TOPIC_LABELS[item.topic] ?? item.topic}
                </td>
                <td className="px-4 py-3">{item.answerType}</td>
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
                        title="Tampilkan lagi di Latihan"
                      >
                        <Eye size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary !px-2.5 !py-1"
                        onClick={() => void hideItem(item)}
                        title="Sembunyikan dari Latihan"
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
                  colSpan={6}
                  className="px-4 py-8 text-center text-[var(--muted)]"
                >
                  Tidak ada soal.
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
            className="panel relative my-6 w-full max-w-3xl space-y-4 rounded-3xl p-5 shadow-[0_20px_60px_rgba(28,36,48,0.25)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                  {creating ? "Buat soal" : "Edit soal"}
                  {formSource ? ` · ${formSource}` : ""}
                </p>
                <h2 className="display text-2xl">
                  {creating ? "Soal baru (bank AI)" : form.title || form.id}
                </h2>
                {!creating && formSource === "curated" ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Perubahan curated disimpan sebagai overlay (file JSON tidak
                    diubah).
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

            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="input md:col-span-2"
                placeholder="Judul"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                required
              />
              <select
                className="select"
                value={form.track}
                onChange={(e) => {
                  const t = e.target.value as TrackId;
                  setForm((f) => ({
                    ...f,
                    track: t,
                    topic: TRACKS[t].topics[0]!,
                  }));
                }}
              >
                {Object.entries(TRACKS).map(([id, meta]) => (
                  <option key={id} value={id}>
                    {id}. {meta.name}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={form.topic}
                onChange={(e) =>
                  setForm((f) => ({ ...f, topic: e.target.value }))
                }
              >
                {topicsForForm.map((t) => (
                  <option key={t} value={t}>
                    {TOPIC_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={form.difficulty}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    difficulty: Number(e.target.value),
                  }))
                }
              >
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>
                    Difficulty {d}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={form.answerType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    answerType: e.target
                      .value as ProblemForm["answerType"],
                  }))
                }
              >
                {["numeric", "short_string", "mcq", "python_output", "codeSpec"].map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Stem (markdown)</label>
                <button
                  type="button"
                  className="btn btn-secondary !px-2.5 !py-1 text-xs"
                  onClick={() => setPreview((v) => !v)}
                >
                  {preview ? (
                    <>
                      <EyeOff size={13} /> Sembunyikan preview
                    </>
                  ) : (
                    <>
                      <Eye size={13} /> Preview
                    </>
                  )}
                </button>
              </div>
              {preview ? (
                <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-3">
                  <Markdown content={form.stem || "_kosong_"} />
                </div>
              ) : (
                <textarea
                  className="textarea min-h-[140px]"
                  value={form.stem}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stem: e.target.value }))
                  }
                  required
                />
              )}
            </div>

            {form.answerType === "mcq" ? (
              <textarea
                className="textarea min-h-[88px]"
                placeholder={"Pilihan (satu per baris)\nA\nB\nC"}
                value={form.choicesText}
                onChange={(e) =>
                  setForm((f) => ({ ...f, choicesText: e.target.value }))
                }
              />
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="input"
                placeholder="Jawaban"
                value={form.answer}
                onChange={(e) =>
                  setForm((f) => ({ ...f, answer: e.target.value }))
                }
                required
              />
              {form.answerType === "numeric" ? (
                <input
                  className="input"
                  placeholder="Tolerance"
                  value={form.tolerance}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tolerance: e.target.value }))
                  }
                />
              ) : (
                <div />
              )}
            </div>

            <textarea
              className="textarea min-h-[100px]"
              placeholder="Solusi / pembahasan"
              value={form.solution}
              onChange={(e) =>
                setForm((f) => ({ ...f, solution: e.target.value }))
              }
              required
            />

            {form.answerType === "python_output" ? (
              <textarea
                className="textarea min-h-[80px] font-mono text-sm"
                placeholder="Starter code (opsional)"
                value={form.starterCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, starterCode: e.target.value }))
                }
              />
            ) : null}

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
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
