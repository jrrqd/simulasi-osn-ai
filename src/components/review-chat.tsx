"use client";

import { FormEvent, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AssistantMessageBubble } from "@/components/assistant-message";
import {
  AssistantTypingIndicator,
  shouldShowAssistantTyping,
} from "@/components/assistant-typing";

export function ReviewChat({
  problemId,
  studentAnswer,
}: {
  problemId: string;
  studentAnswer?: unknown;
}) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      body: { problemId, studentAnswer },
    }),
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="panel flex h-[520px] flex-col rounded-3xl p-4">
      <h2 className="display mb-3 text-xl">Tanya Tutor AI</h2>
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            Tanyakan langkah solusi, konsep terkait, atau kenapa jawabanmu salah.
            Chat hanya untuk soal ini.
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
      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tulis pertanyaan…"
          disabled={status === "streaming" || status === "submitted"}
        />
        <button
          className="btn btn-primary"
          disabled={status === "streaming" || status === "submitted"}
        >
          Kirim
        </button>
      </form>
    </div>
  );
}
