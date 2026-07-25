"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, X } from "lucide-react";
import { AssistantMessageBubble } from "@/components/assistant-message";

export function AdminAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const focusUserId = useMemo(() => {
    const match = pathname?.match(/^\/admin\/users\/([^/?#]+)/);
    return match?.[1] ?? "";
  }, [pathname]);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: `admin-assistant:${focusUserId || "overview"}`,
    transport: new DefaultChatTransport({
      api: "/api/ai/admin-assistant",
      body: { focusUserId: focusUserId || undefined },
    }),
  });

  useEffect(() => {
    setMessages([]);
  }, [focusUserId, setMessages]);

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
        <div className="panel flex h-[min(30rem,72vh)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl shadow-[0_12px_40px_rgba(28,36,48,0.18)] rise">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[#173d34] px-4 py-3 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
                Admin AI
              </p>
              <h2 className="display text-lg leading-tight text-white">
                Asisten platform
              </h2>
            </div>
            <button
              type="button"
              className="rounded-full p-2 text-white/80 hover:bg-white/10"
              onClick={() => setOpen(false)}
              aria-label="Tutup asisten admin"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <div className="space-y-2 text-sm text-[var(--muted)]">
                <p>
                  Tanya apa saja tentang aktivitas platform: perilaku siswa,
                  akurasi, topik lemah, mock, atau siapa yang perlu perhatian.
                </p>
                {focusUserId ? (
                  <p className="rounded-2xl bg-[rgba(15,110,86,0.08)] px-3 py-2 text-xs text-[var(--ink)]">
                    Konteks: laporan pengguna yang sedang dibuka.
                  </p>
                ) : (
                  <p className="text-xs">
                    Contoh: “Siapa siswa paling tidak aktif minggu ini?” atau
                    “Topik mana yang paling lemah?”
                  </p>
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
              placeholder="Tanya tentang platform…"
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
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#173d34] text-white shadow-[0_8px_24px_rgba(23,61,52,0.4)] transition hover:scale-105"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Tutup asisten admin" : "Buka asisten admin"}
      >
        {open ? <X size={22} /> : <Bot size={22} />}
      </button>
    </div>
  );
}
