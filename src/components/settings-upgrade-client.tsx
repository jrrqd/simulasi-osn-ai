"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrakteerSupportButton } from "@/components/trakteer-support-button";
import { appPath } from "@/lib/app-path";

type UpgradeStatus = {
  userType: string;
  userTypeLabel: string;
  isAdmin: boolean;
  vipExpiresAt: string | null;
  quota: {
    used: number;
    limit: number | null;
    remaining: number | null;
    gated: boolean;
  };
  vip: {
    priceIdr: number;
    durationDays: number;
    trakteerUrl: string;
  };
  email?: string;
};

function formatIdr(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function SettingsUpgradeClient({
  userEmail,
}: {
  userEmail: string;
}) {
  const [status, setStatus] = useState<UpgradeStatus | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(appPath("/api/ai/assistant-quota"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setStatus(data as UpgradeStatus);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(userEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const price = status?.vip.priceIdr ?? 50_000;
  const days = status?.vip.durationDays ?? 30;
  const trakteerUrl =
    status?.vip.trakteerUrl ?? "https://trakteer.id/suluhadi";
  const vipUntil = status?.vipExpiresAt
    ? new Date(status.vipExpiresAt).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "long",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="panel space-y-3 rounded-3xl p-5">
        <h2 className="display text-2xl">Status akun</h2>
        <p className="text-sm text-[var(--muted)]">
          Tipe:{" "}
          <span className="font-semibold text-[var(--ink)]">
            {status?.userTypeLabel ?? "…"}
          </span>
          {vipUntil ? (
            <>
              {" "}
              · VIP sampai <strong>{vipUntil} WIB</strong>
            </>
          ) : null}
        </p>
        {status?.quota.gated && status.quota.limit != null ? (
          <p className="text-sm text-[var(--muted)]">
            Kuota asisten AI hari ini: {status.quota.used}/{status.quota.limit}
            {status.quota.remaining != null
              ? ` (sisa ${status.quota.remaining})`
              : ""}
            . Reset setiap 00:00 WIB.
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Asisten AI tanpa batas kuota harian
            {status?.isAdmin ? " (admin)" : ""}.
          </p>
        )}
      </div>

      <div className="panel space-y-4 rounded-3xl p-5">
        <h2 className="display text-2xl">Upgrade VIP</h2>
        <p className="text-sm text-[var(--muted)]">
          {formatIdr(price)} untuk {days} hari. Termasuk asisten AI tanpa batas
          kuota. Perpanjangan menambah {days} hari dari tanggal kadaluarsa
          aktif.
        </p>

        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--muted)]">
          <li>
            Salin email akunmu:{" "}
            <code className="rounded bg-black/5 px-1.5 py-0.5 text-[var(--ink)]">
              {userEmail}
            </code>{" "}
            <button
              type="button"
              className="text-[var(--accent)] underline"
              onClick={copyEmail}
            >
              {copied ? "Tersalin" : "Salin"}
            </button>
          </li>
          <li>
            Bayar tepat {formatIdr(price)} lewat Trakteer, dan{" "}
            <strong className="text-[var(--ink)]">
              tulis email itu di pesan dukungan
            </strong>{" "}
            agar VIP otomatis aktif.
          </li>
          <li>
            Setelah pembayaran sukses, refresh halaman ini. Email konfirmasi
            dikirim ke akunmu.
          </li>
        </ol>

        <TrakteerSupportButton pageUrl={trakteerUrl} />

        <p className="text-xs text-[var(--muted)]">
          Butuh bantuan? Hubungi admin, atau pasang API key sendiri di{" "}
          <Link href="/settings/byok" className="underline">
            BYOK
          </Link>{" "}
          untuk bypass kuota tanpa VIP.
        </p>
      </div>
    </div>
  );
}
