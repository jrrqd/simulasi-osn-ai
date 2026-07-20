"use client";

import { useEffect, useMemo, useState } from "react";

/** Target: start of Seleksi day (WIB). */
export const SELEKSI_AT = "2026-07-30T00:00:00+07:00";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds, done: ms <= 0 };
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="countdown-unit">
      <span className="countdown-value">
        {String(value).padStart(2, "0")}
      </span>
      <span className="countdown-label">{label}</span>
    </div>
  );
}

export function EventCountdown({
  target = SELEKSI_AT,
  eventLabel = "Seleksi",
  eventDateLabel = "30 Juli 2026",
}: {
  target?: string;
  eventLabel?: string;
  eventDateLabel?: string;
}) {
  const end = useMemo(() => new Date(target).getTime(), [target]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { days, hours, minutes, seconds, done } = parts(end - now);

  if (done) {
    return (
      <div className="countdown-banner">
        <p className="countdown-kicker">{eventLabel} · {eventDateLabel}</p>
        <p className="display text-2xl text-[var(--accent)] md:text-3xl">
          Seleksi sedang / telah berlangsung
        </p>
      </div>
    );
  }

  return (
    <div className="countdown-banner rise rise-delay-1">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="countdown-kicker">{eventLabel}</p>
          <p className="display text-xl leading-tight md:text-2xl">
            {eventDateLabel}
          </p>
        </div>
        <p className="text-sm text-[var(--muted)]">Hitung mundur menuju seleksi</p>
      </div>
      <div className="countdown-grid" aria-live="polite">
        <Unit value={days} label="Hari" />
        <Unit value={hours} label="Jam" />
        <Unit value={minutes} label="Menit" />
        <Unit value={seconds} label="Detik" />
      </div>
    </div>
  );
}
