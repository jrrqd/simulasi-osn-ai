"use client";

import { FormEvent, useEffect, useMemo, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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

function PracticeAssistantInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const pet = useAssistantPet();

  const problemId = useMemo(() => {
    const match = pathname?.match(/^\/practice\/([^/?#]+)/);
    const id = match?.[1] ?? "";
    // Section tabs are not problem routes.
    if (id === "generate" || id === "ioai") return "";
    return id;
  }, [pathname]);

  const track = searchParams.get("track") ?? "";
  const topic = searchParams.get("topic") ?? "";

  const chatId = problemId
    ? `practice-assistant:problem:${problemId}`
    : `practice-assistant:list:${track || "all"}:${topic || "all"}`;

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: "/api/ai/practice-assistant",
      body: {
        problemId: problemId || undefined,
        track: !problemId && track ? track : undefined,
        topic: !problemId && topic ? topic : undefined,
      },
    }),
  });

  useEffect(() => {
    setMessages([]);
    setOpen(false);
  }, [chatId, setMessages]);

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
                Asisten latihan
              </p>
              <h2 className="display text-lg leading-tight">
                {problemId ? "Hint side quest" : "Coach side quest"}
              </h2>
            </div>
            <button
              type="button"
              className="rounded-full p-2 text-[var(--muted)] hover:bg-black/5"
              onClick={() => setOpen(false)}
              aria-label="Tutup asisten latihan"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <div className="space-y-2 text-sm text-[var(--muted)]">
                {problemId ? (
                  <>
                    <p>
                      Asisten melihat soal yang sedang kamu kerjakan. Minta hint
                      konsep atau langkah — tanpa spoiler jawaban.
                    </p>
                    <p className="text-xs">
                      Contoh: “Konsep apa yang dipakai di soal ini?” atau “Hint
                      langkah pertama saja.”
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Asisten memahami filter track/topik di halaman ini. Bantu
                      pilih side quest atau rencana generate tantangan.
                    </p>
                    <p className="text-xs">
                      Contoh: “Soal mana yang cocok untuk pemula di topik ini?”
                    </p>
                  </>
                )}
              </div>
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
        aria-label={open ? "Tutup asisten latihan" : "Buka asisten latihan"}
      >
        <AssistantFabIcon open={open} pet={pet} />
      </button>
    </div>
  );
}

export function PracticeAssistant() {
  return (
    <Suspense fallback={null}>
      <PracticeAssistantInner />
    </Suspense>
  );
}
