"use client";

import { assistantMessageText } from "@/components/assistant-message";

type ChatMessageLike = {
  role: string;
  parts?: readonly { type: string; text?: string }[];
};

/** Show dots while waiting for first assistant tokens. */
export function shouldShowAssistantTyping(
  status: string,
  messages: readonly ChatMessageLike[],
): boolean {
  if (status !== "submitted" && status !== "streaming") return false;
  const last = messages[messages.length - 1];
  if (!last) return true;
  if (last.role === "user") return true;
  if (last.role === "assistant") {
    return assistantMessageText(last.parts ?? []).length === 0;
  }
  return false;
}

export function AssistantTypingIndicator() {
  return (
    <div
      className="mr-6 inline-flex items-center gap-1.5 rounded-2xl bg-white/80 px-3 py-2.5"
      aria-live="polite"
      aria-label="Asisten sedang mengetik"
      role="status"
    >
      <span className="assistant-typing-dot" />
      <span className="assistant-typing-dot" />
      <span className="assistant-typing-dot" />
    </div>
  );
}
