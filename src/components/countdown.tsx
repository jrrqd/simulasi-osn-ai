"use client";

import { useEffect, useMemo, useState } from "react";

export function Countdown({
  endsAt,
  onExpire,
}: {
  endsAt: string | Date;
  onExpire?: () => void;
}) {
  const end = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (now >= end) onExpire?.();
  }, [now, end, onExpire]);

  const remain = Math.max(0, end - now);
  const h = Math.floor(remain / 3600000);
  const m = Math.floor((remain % 3600000) / 60000);
  const s = Math.floor((remain % 60000) / 1000);
  const urgent = remain < 10 * 60 * 1000;

  return (
    <div
      className={`panel rounded-full px-4 py-2 font-mono text-sm ${
        urgent ? "text-[var(--bad)]" : ""
      }`}
    >
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:
      {String(s).padStart(2, "0")}
    </div>
  );
}
