"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { appPath } from "@/lib/app-path";

export type AssistantQuotaInfo = {
  used: number;
  limit: number | null;
  remaining: number | null;
  resetsAt: string;
  gated: boolean;
};

/** Fetch that surfaces JSON `{ error }` on non-OK assistant responses. */
export async function assistantChatFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.ok) return res;
  const data = (await res
    .clone()
    .json()
    .catch(() => null)) as { error?: string; code?: string } | null;
  if (data?.error) {
    throw new Error(data.error);
  }
  return res;
}

export function useAssistantQuota(enabled: boolean) {
  const [quota, setQuota] = useState<AssistantQuotaInfo | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch(appPath("/api/ai/assistant-quota"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.quota) {
          setQuota(data.quota as AssistantQuotaInfo);
        }
      })
      .catch(() => {
        /* optional UI */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return {
    quota,
    refresh: () => {
      fetch(appPath("/api/ai/assistant-quota"))
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.quota) setQuota(data.quota as AssistantQuotaInfo);
        })
        .catch(() => undefined);
    },
  };
}

export function AssistantQuotaLabel({
  quota,
}: {
  quota: AssistantQuotaInfo | null;
}) {
  if (!quota?.gated || quota.limit == null) return null;
  const remaining = quota.remaining ?? 0;
  return (
    <p className="mt-0.5 text-[10px] font-medium text-[var(--muted)]">
      Kuota hari ini: {quota.used}/{quota.limit}
      {remaining <= 0 ? " · habis" : ` · sisa ${remaining}`}
    </p>
  );
}

export function AssistantChatError({
  error,
}: {
  error: Error | undefined;
}) {
  if (!error) return null;
  const isQuota =
    error.message.includes("Kuota asisten") ||
    error.message.includes("AI_ASSISTANT_QUOTA");
  return (
    <div className="space-y-1 text-sm text-[var(--bad)]">
      <p>{error.message}</p>
      {isQuota ? (
        <p>
          <Link
            href="/settings/upgrade"
            className="font-semibold text-[var(--accent)] underline"
          >
            Upgrade ke VIP
          </Link>{" "}
          untuk asisten tanpa batas.
        </p>
      ) : null}
    </div>
  );
}
