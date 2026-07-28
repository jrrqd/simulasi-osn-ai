"use client";

import { useMemo, useState } from "react";
import {
  formatCompositionLabel,
  previewMockComposition,
} from "@/lib/ai/admin-mock-composition";
import type { AiMockSize } from "@/lib/ai/ai-mock-plan";
import { AI_MOCK_SIZES } from "@/lib/ai/ai-mock-plan";

/**
 * Compact OSN AI 2026 mock composition preview for admin.
 * Shows 70:30 isian:coding mix and 2:1 weights by size.
 */
export function AdminMockCompositionPreview() {
  const [size, setSize] = useState<AiMockSize>("quick");
  const preview = useMemo(
    () => previewMockComposition({ size }),
    [size],
  );

  return (
    <div className="panel space-y-3 rounded-3xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Format OSN AI 2026
          </p>
          <h2 className="display text-xl">Komposisi simulasi AI</h2>
        </div>
        <select
          className="input !w-auto"
          value={size}
          onChange={(e) => setSize(e.target.value as AiMockSize)}
        >
          {AI_MOCK_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-sm text-[var(--muted)]">
        {formatCompositionLabel(preview)}
      </p>
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        <li className="rounded-2xl bg-white/60 px-3 py-2">
          Isian singkat: {preview.numericCount} soal ×{" "}
          {preview.numericWeightEach} = {preview.numericCount * preview.numericWeightEach}{" "}
          poin
        </li>
        <li className="rounded-2xl bg-white/60 px-3 py-2">
          Coding Python: {preview.codingCount} soal ×{" "}
          {preview.codingWeightEach} = {preview.codingCount * preview.codingWeightEach}{" "}
          poin
        </li>
      </ul>
      <p className="text-xs text-[var(--muted)]">
        Generate simulasi AI memakai mix ini otomatis (codeSpec + numericFormat
        strict). Bank curated lama tetap legacy-compatible.
      </p>
    </div>
  );
}
