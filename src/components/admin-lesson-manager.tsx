"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";

type CheckRow = {
  id: string;
  prompt: string;
  answerType: string;
  answer: string | number | string[];
  explanation: string;
  difficulty?: number;
  conceptTags?: string[];
  hints?: string[];
  source?: string;
};

type LessonItem = {
  id: string;
  title: string;
  track: string;
  topic: string;
  topicLabel: string;
  curatedCount: number;
  visibleCount: number;
  generatedCount: number;
  hiddenGeneratedCount: number;
  checks: CheckRow[];
  generated: {
    id: string;
    hidden: boolean;
    payload: Record<string, unknown>;
    updatedAt: string;
  }[];
};

export function AdminLessonManager() {
  const [items, setItems] = useState<LessonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/lessons");
    const data = await res.json();
    setLoading(false);
    if (res.ok) setItems(data.items ?? []);
    else setMessage(data.error || "Gagal memuat");
  }, []);

  useEffect(() => {
    // Initial admin list fetch (same pattern as other admin managers).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount load
    void load();
  }, [load]);

  async function toggleHide(id: string, hide: boolean) {
    const res = await fetch("/api/admin/lessons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: hide ? "hide" : "restore",
        id,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Gagal update");
      return;
    }
    setMessage(hide ? "Cek konsep disembunyikan" : "Cek konsep dipulihkan");
    await load();
  }

  async function generateFor(lessonId: string) {
    setGeneratingId(lessonId);
    setMessage("");
    try {
      const res = await fetch("/api/ai/generate-lesson-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, count: 4 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal generate");
      setMessage(`Berhasil menambah ${data.checks?.length ?? 0} cek konsep`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error");
    } finally {
      setGeneratingId(null);
    }
  }

  async function saveTags(lessonId: string, check: CheckRow) {
    const tagsRaw = window.prompt(
      "conceptTags (pisah koma)",
      (check.conceptTags ?? []).join(", "),
    );
    if (tagsRaw == null) return;
    const hintsRaw = window.prompt(
      "hints (pisah | )",
      (check.hints ?? []).join(" | "),
    );
    const difficultyRaw = window.prompt(
      "difficulty 1-3",
      String(check.difficulty ?? 2),
    );
    const conceptTags = tagsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const hints = (hintsRaw ?? "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    const difficulty = Number(difficultyRaw);
    const res = await fetch("/api/admin/lessons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert",
        lessonId,
        question: {
          ...check,
          conceptTags,
          hints,
          difficulty:
            difficulty === 1 || difficulty === 2 || difficulty === 3
              ? difficulty
              : 2,
          source: check.source ?? "admin",
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Gagal menyimpan");
      return;
    }
    setMessage("Cek konsep diperbarui");
    await load();
  }

  return (
    <div className="space-y-5">
      {message ? (
        <p className="rounded-xl bg-white/70 px-3 py-2 text-sm">{message}</p>
      ) : null}
      <p className="text-sm text-[var(--muted)]">
        {loading ? "Memuat…" : `${items.length} modul`} · curated dari JSON;
        AI/admin extras di DB (bisa soft-delete).
      </p>

      <div className="panel overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-white/40">
            <tr>
              {["Modul", "Track", "Cek konsep", "AI extras", "Aksi"].map(
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
              <Fragment key={item.id}>
                <tr className="border-b border-[var(--line)]/70">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-left font-medium hover:underline"
                      onClick={() =>
                        setExpanded((e) => (e === item.id ? null : item.id))
                      }
                    >
                      {item.title}
                    </button>
                    <p className="text-xs text-[var(--muted)]">{item.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    {item.track} · {item.topicLabel}
                  </td>
                  <td className="px-4 py-3">
                    {item.visibleCount} terlihat ({item.curatedCount} curated)
                  </td>
                  <td className="px-4 py-3">
                    {item.generatedCount} aktif
                    {item.hiddenGeneratedCount
                      ? ` · ${item.hiddenGeneratedCount} hidden`
                      : ""}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="btn btn-secondary !py-1"
                      disabled={generatingId === item.id}
                      onClick={() => void generateFor(item.id)}
                    >
                      <Sparkles size={14} />
                      {generatingId === item.id ? "…" : "Generate"}
                    </button>
                  </td>
                </tr>
                {expanded === item.id ? (
                  <tr className="bg-black/[0.02]">
                    <td colSpan={5} className="px-4 py-4">
                      <div className="space-y-3">
                        {item.checks.map((c) => (
                          <div
                            key={c.id}
                            className="rounded-2xl border border-[var(--line)] bg-white/70 p-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-medium">{c.prompt}</p>
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                  {c.answerType} · kunci: {String(c.answer)} ·{" "}
                                  {c.source ?? "curated"}
                                  {c.conceptTags?.length
                                    ? ` · tags: ${c.conceptTags.join(", ")}`
                                    : ""}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="btn btn-secondary !py-1"
                                  onClick={() => void saveTags(item.id, c)}
                                >
                                  Edit meta
                                </button>
                                {c.source === "ai" || c.source === "admin" ? (
                                  <button
                                    type="button"
                                    className="btn btn-secondary !py-1"
                                    onClick={() => void toggleHide(c.id, true)}
                                  >
                                    <EyeOff size={14} />
                                    Hide
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                        {item.generated
                          .filter((g) => g.hidden)
                          .map((g) => (
                            <div
                              key={g.id}
                              className="flex items-center justify-between rounded-2xl border border-dashed border-[var(--line)] px-3 py-2 opacity-70"
                            >
                              <span className="text-sm">
                                Hidden: {String(g.payload.prompt ?? g.id)}
                              </span>
                              <button
                                type="button"
                                className="btn btn-secondary !py-1"
                                onClick={() => void toggleHide(g.id, false)}
                              >
                                <Eye size={14} />
                                Restore
                              </button>
                            </div>
                          ))}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
