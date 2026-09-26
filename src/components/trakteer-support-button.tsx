"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    trbtn?: {
      init: (
        label: string,
        color: string,
        pageUrl: string,
        iconUrl: string,
        height: string,
      ) => string;
      draw: (id: string) => void;
    };
  }
}

const TRAKTEER_SCRIPT =
  "https://edge-cdn.trakteer.id/js/embed/trbtn.min.js?v=14-05-2025";
const TRAKTEER_ICON =
  "https://edge-cdn.trakteer.id/images/embed/trbtn-icon.png?v=14-05-2025";

/**
 * Official Trakteer embed button (Rp support page).
 * Falls back to a plain link if the script fails to load.
 */
export function TrakteerSupportButton({
  pageUrl = "https://trakteer.id/suluhadi",
  label = "Bayar via Trakteer",
}: {
  pageUrl?: string;
  label?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;

    function draw() {
      if (cancelled || !host || !window.trbtn) return;
      host.innerHTML = "";
      const id = window.trbtn.init(
        label,
        "#be1e2d",
        pageUrl,
        TRAKTEER_ICON,
        "40",
      );
      window.trbtn.draw(id);
      // Move drawn button into our host if script appends elsewhere.
      const drawn = document.getElementById(id);
      if (drawn && drawn.parentElement !== host) {
        host.appendChild(drawn);
      }
    }

    if (window.trbtn) {
      draw();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TRAKTEER_SCRIPT}"]`,
    );
    if (existing) {
      existing.addEventListener("load", draw);
      return () => {
        cancelled = true;
        existing.removeEventListener("load", draw);
      };
    }

    const script = document.createElement("script");
    script.src = TRAKTEER_SCRIPT;
    script.async = true;
    script.onload = draw;
    document.body.appendChild(script);
    return () => {
      cancelled = true;
    };
  }, [label, pageUrl]);

  return (
    <div className="space-y-2">
      <div ref={hostRef} className="min-h-10" />
      <p className="text-xs text-[var(--muted)]">
        Atau buka langsung:{" "}
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--accent)] underline"
        >
          {pageUrl.replace(/^https?:\/\//, "")}
        </a>
      </p>
    </div>
  );
}
