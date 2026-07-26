"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, X } from "lucide-react";
import { AssistantMessageBubble } from "@/components/assistant-message";
import {
  AssistantTypingIndicator,
  shouldShowAssistantTyping,
} from "@/components/assistant-typing";

function pageHint(pathname: string, focusUserId: string): string {
  if (focusUserId) {
    return "Konteks: laporan pengguna yang sedang dibuka + snapshot platform.";
  }
  if (pathname.startsWith("/study")) {
    return "Konteks: halaman belajar (modul/silabus) yang sedang dibuka.";
  }
  if (pathname.startsWith("/practice")) {
    return "Konteks: halaman latihan / soal yang sedang dibuka.";
  }
  if (pathname.startsWith("/mock")) {
    return "Konteks: daftar atau sesi simulasi yang sedang dibuka.";
  }
  if (pathname.startsWith("/performance")) {
    return "Konteks: halaman performa + data agregat platform.";
  }
  if (pathname.startsWith("/admin")) {
    return "Konteks: konsol admin + snapshot aktivitas platform.";
  }
  if (pathname.startsWith("/settings")) {
    return "Konteks: halaman pengaturan.";
  }
  return "Konteks mengikuti halaman yang sedang dibuka + snapshot platform.";
}

function AdminAssistantInner() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const search = searchParams.toString();
  const focusUserId = useMemo(() => {
    const match = pathname.match(/^\/admin\/users\/([^/?#]+)/);
    return match?.[1] ?? "";
  }, [pathname]);

  const chatId = useMemo(
    () => `admin-assistant:${pathname}?${search}|${focusUserId || "none"}`,
    [pathname, search, focusUserId],
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: "/api/ai/admin-assistant",
      body: {
        focusUserId: focusUserId || undefined,
        pathname,
        search: search ? `?${search}` : undefined,
      },
    }),
  });

  useEffect(() => {
    setMessages([]);
  }, [chatId, setMessages]);

  // Keep admin FAB on the left so it does not cover student pet assistants.
  const dockClass = pathname.startsWith("/admin")
    ? "fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3"
    : "fixed bottom-5 left-5 z-50 flex flex-col items-start gap-3";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className={dockClass}>
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
                  Tanya tentang halaman ini atau aktivitas platform: siswa,
                  akurasi, topik lemah, mock, atau isi soal/modul yang sedang
                  dibuka.
                </p>
                <p className="rounded-2xl bg-[rgba(15,110,86,0.08)] px-3 py-2 text-xs text-[var(--ink)]">
                  {pageHint(pathname, focusUserId)}
                </p>
                <p className="text-xs">
                  Contoh: “Ringkas halaman ini” · “Siapa perlu follow-up?” ·
                  “Jelaskan soal ini”
                </p>
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
              placeholder="Tanya tentang halaman / platform…"
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

export function AdminAssistant() {
  return (
    <Suspense fallback={null}>
      <AdminAssistantInner />
    </Suspense>
  );
}
