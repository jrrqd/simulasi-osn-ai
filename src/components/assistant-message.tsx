"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Markdown } from "@/components/markdown";

type TextPart = { type: string; text?: string };

export function assistantMessageText(parts: readonly TextPart[]) {
  return parts
    .filter(
      (part): part is TextPart & { text: string } =>
        part.type === "text" &&
        typeof part.text === "string" &&
        part.text.length > 0,
    )
    .map((part) => part.text)
    .join("\n\n")
    .trim();
}

export function AssistantMessageBubble({
  role,
  parts,
}: {
  role: string;
  parts: readonly TextPart[];
}) {
  const isUser = role === "user";
  const text = assistantMessageText(parts);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={`rounded-2xl px-3 py-2 text-sm ${
        isUser ? "ml-6 bg-[rgba(15,110,86,0.12)]" : "mr-6 bg-white/80"
      }`}
    >
      {parts.map((part, i) =>
        part.type === "text" && part.text ? (
          <Markdown key={i} content={part.text} />
        ) : null,
      )}
      {!isUser && text ? (
        <div className="mt-2 flex justify-end border-t border-[var(--line)]/70 pt-1.5">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--ink)]"
            aria-label="Salin jawaban"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Tersalin" : "Salin"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
