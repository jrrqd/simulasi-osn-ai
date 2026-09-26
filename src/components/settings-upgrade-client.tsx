"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
};

function formatIdr(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Prefer tip page so the payment form opens, not the profile feed. */
function tipUrl(pageUrl: string): string {
  const base = pageUrl.replace(/\/$/, "");
  if (/\/tip\/?$/.test(base)) return base;
  return `${base}/tip`;
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
      return true;
    } catch {
      setCopied(false);
      return false;
    }
  }

  async function startCheckout() {
    await copyEmail();
    const url = tipUrl(
      status?.vip.trakteerUrl ?? "https://trakteer.id/suluhadi",
    );
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const price = status?.vip.priceIdr ?? 50_000;
  const days = status?.vip.durationDays ?? 30;
  const vipUntil = status?.vipExpiresAt
    ? new Date(status.vipExpiresAt).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "long",
        timeStyle: "short",
      })
    : null;
  const alreadyVip = status?.userType === "vip" && !status?.isAdmin;

  const benefits = [
    {
      label: "Asisten AI",
      description: "Tanpa batas kuota chat harian.",
    },
    {
      label: "Generate simulasi",
      description: "Tanpa batas 1×/hari untuk akun gratis.",
    },
    {
      label: "Aktivasi otomatis",
      description: "VIP aktif setelah pembayaran Trakteer sukses.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="panel space-y-4 rounded-3xl p-5">
        <div>
          <h2 className="display text-2xl">Status akun</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Jenis akun dan sisa kuota asisten AI hari ini.
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Jenis akun
          </p>
          <p className="text-lg font-semibold text-[var(--ink)]">
            {status?.userTypeLabel ?? "…"}
          </p>
          {vipUntil ? (
            <p className="text-sm text-[var(--muted)]">
              VIP sampai <strong>{vipUntil} WIB</strong>
            </p>
          ) : null}
        </div>

        {status?.quota.gated && status.quota.limit != null ? (
          <p className="text-sm text-[var(--muted)]">
            Kuota asisten hari ini: {status.quota.used}/{status.quota.limit}
            {status.quota.remaining != null
              ? ` · sisa ${status.quota.remaining}`
              : ""}
            . Reset 00:00 WIB.
          </p>
        ) : status ? (
          <p className="text-sm text-[var(--muted)]">
            Asisten AI tanpa batas kuota harian
            {status.isAdmin ? " (admin)" : ""}.
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">Memuat…</p>
        )}
      </div>

      <div className="panel space-y-4 rounded-3xl p-5">
        <div>
          <h2 className="display text-2xl">Upgrade VIP</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {formatIdr(price)} untuk {days} hari. Perpanjangan menambah {days}{" "}
            hari dari tanggal kadaluarsa aktif.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Yang didapat
          </p>
          <ul className="space-y-2">
            {benefits.map((b) => (
              <li
                key={b.label}
                className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--ink)]">
                    {b.label}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{b.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[rgba(15,110,86,0.12)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)]">
                  VIP
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Cara bayar
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--muted)]">
            <li>
              Klik tombol bayar — email{" "}
              <code className="rounded bg-black/5 px-1.5 py-0.5 text-[var(--ink)]">
                {userEmail}
              </code>{" "}
              disalin otomatis.{" "}
              <button
                type="button"
                className="text-[var(--accent)] underline"
                onClick={() => void copyEmail()}
              >
                {copied ? "Tersalin" : "Salin"}
              </button>
            </li>
            <li>
              Di Trakteer pilih 1 unit = {formatIdr(price)}, tempel email di
              pesan dukungan, lalu bayar.
            </li>
            <li>Kembali ke halaman ini dan refresh — VIP aktif otomatis.</li>
          </ol>
        </div>

        <div className="rounded-2xl bg-[rgba(15,110,86,0.08)] px-4 py-3">
          <p className="text-sm text-[var(--ink)]">
            Pembayaran lewat Trakteer (QRIS / e-wallet / VA). Data kartu tidak
            disimpan di sini.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void startCheckout()}
            >
              {alreadyVip
                ? `Perpanjang · ${formatIdr(price)}`
                : `Bayar · ${formatIdr(price)}`}
            </button>
            <Link href="/settings/byok" className="btn btn-secondary">
              Pakai BYOK
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
