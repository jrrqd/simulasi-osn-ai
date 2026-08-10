"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type SimulasiQuotaInfo = {
  userType: string;
  userTypeLabel: string;
  isAdmin: boolean;
  aiSource: "personal" | "admin" | "default" | null;
  personalReady: boolean;
  simulasi: {
    used: number;
    limit: number | null;
    remaining: number | null;
    resetsAt: string;
    gated: boolean;
  };
};

export function useSimulasiQuota() {
  const [quota, setQuota] = useState<SimulasiQuotaInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/quota")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setQuota(data as SimulasiQuotaInfo);
      })
      .catch(() => {
        /* ignore — banner is optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { quota, setQuota };
}

export function SimulasiQuotaBanner({
  quota,
}: {
  quota: SimulasiQuotaInfo | null;
}) {
  if (!quota?.simulasi.gated) return null;

  const { used, limit, remaining } = quota.simulasi;
  const exhausted = remaining != null && remaining <= 0;

  return (
    <div
      className={`rounded-2xl px-3 py-2 text-sm ${
        exhausted
          ? "bg-[rgba(196,92,38,0.12)] text-[var(--accent-2)]"
          : "bg-[rgba(15,110,86,0.1)] text-[var(--accent)]"
      }`}
    >
      {exhausted ? (
        <p>
          Kuota simulasi hari ini sudah habis ({used}/{limit}).{" "}
          <Link href="/settings" className="font-semibold underline">
            Pasang API key sendiri
          </Link>{" "}
          untuk generate tanpa batas, atau coba lagi besok.
        </p>
      ) : (
        <p>
          Akun gratis · simulasi hari ini: {used}/{limit} · sisa{" "}
          {remaining}. Unlimited jika{" "}
          <Link href="/settings" className="font-semibold underline">
            pakai API key sendiri
          </Link>
          .
        </p>
      )}
    </div>
  );
}

/** Prefer structured quota error message from API when present. */
export function formatQuotaError(data: {
  error?: string;
  code?: string;
}): string {
  if (data.code === "SIMULASI_QUOTA_EXCEEDED") {
    return (
      data.error ||
      "Kuota simulasi hari ini sudah habis. Pasang API key di Pengaturan atau coba lagi besok."
    );
  }
  return data.error || "Gagal";
}
