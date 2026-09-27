"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { appPath } from "@/lib/app-path";
import { AssistantMessageBubble } from "@/components/assistant-message";
import {
  AssistantTypingIndicator,
  shouldShowAssistantTyping,
} from "@/components/assistant-typing";
import {
  AssistantChatError,
  AssistantQuotaLabel,
  assistantChatFetch,
  useAssistantQuota,
} from "@/components/assistant-quota-ui";
import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";

export type TeachLessonOption = {
  id: string;
  track: TrackId;
  topic: string;
  title: string;
};

export type TeachMemoryItem = {
  id: string;
  status: string;
  note: string;
  topic: string | null;
  source: string;
};

const STATUS_LABEL: Record<string, string> = {
  understood: "Sudah paham",
  struggling: "Masih bingung",
  corrected_misconception: "Misconception dikoreksi",
};

export function TeachMeClient({
  lessons,
  initialMemory,
}: {
  lessons: TeachLessonOption[];
  initialMemory: TeachMemoryItem[];
}) {
  const [track, setTrack] = useState<TrackId | "">("");
  const [topic, setTopic] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [mission, setMission] = useState("");
  const [input, setInput] = useState("");
  const { quota, refresh } = useAssistantQuota(true);

  const focusRef = useRef({
    track: "" as TrackId | "",
    topic: "",
    lessonId: "",
    mission: "",
  });
  focusRef.current = { track, topic, lessonId, mission };

  const topicsForTrack = useMemo(() => {
    if (!track) return [];
    return TRACKS[track].topics;
  }, [track]);

  const lessonsFiltered = useMemo(() => {
    return lessons.filter((l) => {
      if (track && l.track !== track) return false;
      if (topic && l.topic !== topic) return false;
      return true;
    });
  }, [lessons, track, topic]);

  const sessionKey = `teach:${track || "any"}:${topic || "any"}:${lessonId || "none"}`;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: appPath("/api/ai/teach-assistant"),
        body: () => {
          const f = focusRef.current;
          return {
            lessonId: f.lessonId || undefined,
            topic: f.topic || undefined,
            track: f.track || undefined,
            mission: f.mission.trim() || undefined,
          };
        },
        fetch: assistantChatFetch,
      }),
    [],
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: sessionKey,
    transport,
  });

  useEffect(() => {
    setMessages([]);
  }, [sessionKey, setMessages]);

  useEffect(() => {
    if (topic && !topicsForTrack.includes(topic)) {
      setTopic("");
      setLessonId("");
    }
  }, [topicsForTrack, topic]);

  useEffect(() => {
    if (lessonId && !lessonsFiltered.some((l) => l.id === lessonId)) {
      setLessonId("");
    }
  }, [lessonsFiltered, lessonId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput("");
    await sendMessage({ text });
    refresh();
  }

  function startSession() {
    const opener = mission.trim()
      ? `Halo. Misi saya: ${mission.trim()}. Ajarin saya mulai dari unit pertama.`
      : "Halo. Saya mau diajari. Bantu wawancara misi belajar dulu, lalu mulai unit pertama.";
    setInput("");
    void sendMessage({ text: opener }).then(() => refresh());
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="panel space-y-3 rounded-3xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Fokus sesi
          </p>
          <label className="block space-y-1 text-sm">
            <span className="text-[var(--muted)]">Track</span>
            <select
              className="input !py-2 text-sm"
              value={track}
              onChange={(e) => {
                setTrack((e.target.value || "") as TrackId | "");
                setTopic("");
                setLessonId("");
              }}
            >
              <option value="">Semua track</option>
              {(Object.keys(TRACKS) as TrackId[]).map((id) => (
                <option key={id} value={id}>
                  {id}. {TRACKS[id].name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-[var(--muted)]">Topik</span>
            <select
              className="input !py-2 text-sm"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setLessonId("");
              }}
              disabled={!track}
            >
              <option value="">
                {track ? "Pilih topik…" : "Pilih track dulu"}
              </option>
              {topicsForTrack.map((t) => (
                <option key={t} value={t}>
                  {TOPIC_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-[var(--muted)]">Modul (opsional)</span>
            <select
              className="input !py-2 text-sm"
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
            >
              <option value="">Tanpa modul spesifik</option>
              {lessonsFiltered.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-[var(--muted)]">Misi / kenapa belajar</span>
            <textarea
              className="input min-h-[5.5rem] resize-y !py-2 text-sm"
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              placeholder="Contoh: mau paham backprop sebelum mock track C"
              maxLength={400}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary w-full !py-2 text-sm"
            onClick={startSession}
            disabled={
              status === "streaming" ||
              status === "submitted" ||
              messages.length > 0
            }
          >
            Mulai sesi
          </button>
          {messages.length > 0 ? (
            <button
              type="button"
              className="w-full text-center text-xs text-[var(--muted)] hover:underline"
              onClick={() => setMessages([])}
            >
              Reset percakapan
            </button>
          ) : null}
        </div>

        <div className="panel space-y-2 rounded-3xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Memori belajar
          </p>
          {initialMemory.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Belum ada catatan. Setelah sesi, progres singkat akan muncul di
              sini pada kunjungan berikutnya.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {initialMemory.map((item) => (
                <li
                  key={item.id}
                  className="border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"
                >
                  <p className="text-xs text-[var(--muted)]">
                    {STATUS_LABEL[item.status] ?? item.status}
                    {item.topic
                      ? ` · ${TOPIC_LABELS[item.topic] ?? item.topic}`
                      : ""}
                  </p>
                  <p className="leading-snug">{item.note}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="panel flex min-h-[28rem] flex-col overflow-hidden rounded-3xl">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Teach me
          </p>
          <h2 className="display text-xl leading-tight">Sesi mengajar</h2>
          <AssistantQuotaLabel quota={quota} />
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="space-y-2 text-sm text-[var(--muted)]">
              <p>
                Pilih track/topik (dan misi jika sudah jelas), lalu tekan{" "}
                <span className="font-medium text-[var(--ink)]">Mulai sesi</span>
                . Guru akan wawancara singkat, lalu mengajar satu unit per
                giliran dengan cek pemahaman.
              </p>
              <p>
                Skill yang sama dipakai asisten FAB Belajar/Latihan — di sini
                fokusnya sesi Teach me penuh.
              </p>
            </div>
          ) : null}
          {messages.map((m) => (
            <AssistantMessageBubble key={m.id} role={m.role} parts={m.parts} />
          ))}
          {shouldShowAssistantTyping(status, messages) ? (
            <AssistantTypingIndicator />
          ) : null}
          <AssistantChatError error={error} />
        </div>

        <form
          onSubmit={onSubmit}
          className="flex gap-2 border-t border-[var(--line)] p-3"
        >
          <input
            className="input !py-2 text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Jawab kuis, minta hint, atau lanjut unit…"
            disabled={status === "streaming" || status === "submitted"}
          />
          <button
            className="btn btn-primary !px-3 !py-2 text-sm"
            disabled={status === "streaming" || status === "submitted"}
            type="submit"
          >
            Kirim
          </button>
        </form>
      </div>
    </div>
  );
}
