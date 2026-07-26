"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { X } from "lucide-react";
import { AssistantMessageBubble } from "@/components/assistant-message";
import {
  AssistantTypingIndicator,
  shouldShowAssistantTyping,
} from "@/components/assistant-typing";
import {
  AssistantFabIcon,
  assistantFabButtonClass,
  useAssistantPet,
} from "@/components/assistant-fab";

export function StudyAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const pet = useAssistantPet();

  const lessonId = useMemo(() => {
    const match = pathname?.match(/^\/study\/([^/?#]+)/);
    return match?.[1] ?? "";
  }, [pathname]);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: `study-assistant:${lessonId || "index"}`,
    transport: new DefaultChatTransport({
      api: "/api/ai/study-assistant",
      body: { lessonId: lessonId || undefined },
    }),
  });

  useEffect(() => {
    setMessages([]);
    setOpen(false);
  }, [lessonId, setMessages]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="panel flex h-[min(28rem,70vh)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl shadow-[0_12px_40px_rgba(28,36,48,0.18)] rise">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                Asisten belajar
              </p>
              <h2 className="display text-lg leading-tight">Tanya materi</h2>
            </div>
            <button
              type="button"
              className="rounded-full p-2 text-[var(--muted)] hover:bg-black/5"
              onClick={() => setOpen(false)}
              aria-label="Tutup asisten"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-[var(--muted)]">
                {lessonId
                  ? "Tanyakan penjelasan konsep dari modul ini, contoh, atau analogi."
                  : "Pilih modul, atau tanya gambaran silabus track A–D."}
              </p>
            )}
            {messages.map((m) => (
              <AssistantMessageBubble
                key={m.id}
                role={m.role}
                parts={m.parts}
              />
            ))}
            {shouldShowAssistantTyping(status, messages) ? (
              <AssistantTypingIndicator />
            ) : null}
            {error && (
              <p className="text-sm text-[var(--bad)]">{error.message}</p>
            )}
          </div>

          <form
            onSubmit={onSubmit}
            className="flex gap-2 border-t border-[var(--line)] p-3"
          >
            <input
              className="input !py-2 text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tulis pertanyaan…"
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
          {messages.length > 0 && (
            <button
              type="button"
              className="pb-2 text-center text-xs text-[var(--muted)] hover:underline"
              onClick={() => setMessages([])}
            >
              Hapus percakapan
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        className={assistantFabButtonClass(pet)}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Tutup asisten belajar" : "Buka asisten belajar"}
      >
        <AssistantFabIcon open={open} pet={pet} />
      </button>
    </div>
  );
}
