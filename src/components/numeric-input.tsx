"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import type { NumericFormat } from "@/lib/content/types";
import { validateStrictFormat } from "@/lib/scoring";

function formatLabel(format?: NumericFormat, partCount?: number) {
  switch (format) {
    case "integer":
      return 'Bilangan bulat (contoh "25", bukan "25.0")';
    case "decimal":
      return 'Desimal dengan titik (contoh "0.5")';
    case "space_separated":
      return partCount && partCount > 1
        ? `${partCount} angka dipisah spasi tunggal`
        : 'Angka dipisah spasi tunggal (contoh "1 2 3")';
    case "comma_separated":
      return partCount && partCount > 1
        ? `${partCount} angka dipisah koma tanpa spasi`
        : 'Angka dipisah koma tanpa spasi (contoh "1,2,3")';
    default:
      return "Jawaban numerik";
  }
}

function joinParts(parts: string[], format?: NumericFormat) {
  const sep = format === "comma_separated" ? "," : " ";
  return parts.join(sep);
}

function splitValue(value: string, format?: NumericFormat, partCount?: number) {
  if (!partCount || partCount < 2) return [value];
  const sep = format === "comma_separated" ? "," : " ";
  const raw = value.length === 0 ? [] : value.split(sep);
  const parts = Array.from({ length: partCount }, (_, i) => raw[i] ?? "");
  return parts;
}

export function NumericInput({
  value,
  onChange,
  disabled,
  numericFormat,
  partCount,
  showLiveValidation = true,
  validateOnBlur = true,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  numericFormat?: NumericFormat;
  /** For space/comma separated: render N boxes with auto-tab. */
  partCount?: number;
  showLiveValidation?: boolean;
  /** When true, format errors show after blur (and clear when empty). */
  validateOnBlur?: boolean;
  id?: string;
}) {
  const multi =
    (numericFormat === "space_separated" ||
      numericFormat === "comma_separated") &&
    typeof partCount === "number" &&
    partCount >= 2;

  const parts = useMemo(
    () => (multi ? splitValue(value, numericFormat, partCount) : [value]),
    [multi, value, numericFormat, partCount],
  );

  const [blurred, setBlurred] = useState(false);
  const showValidation =
    showLiveValidation && (!validateOnBlur || blurred) && value.trim().length > 0;

  const validation = showValidation
    ? numericFormat
      ? validateStrictFormat(numericFormat, value)
      : { ok: true as const }
    : null;

  function updatePart(index: number, nextPart: string) {
    if (!multi) {
      onChange(nextPart);
      return;
    }
    const next = [...parts];
    // Strip separators typed into a box
    const cleaned =
      numericFormat === "comma_separated"
        ? nextPart.replace(/,/g, "")
        : nextPart.replace(/\s+/g, "");
    next[index] = cleaned;
    onChange(joinParts(next, numericFormat));
  }

  function onPartKeyDown(
    index: number,
    e: KeyboardEvent<HTMLInputElement>,
  ) {
    if (!multi) return;
    if (e.key === " " || (numericFormat === "comma_separated" && e.key === ",")) {
      e.preventDefault();
      const target = document.getElementById(
        `${id ?? "numeric"}-part-${index + 1}`,
      );
      target?.focus();
      return;
    }
    if (e.key === "Backspace" && parts[index] === "" && index > 0) {
      e.preventDefault();
      document.getElementById(`${id ?? "numeric"}-part-${index - 1}`)?.focus();
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-[var(--muted)]">
        {formatLabel(numericFormat, multi ? partCount : undefined)}
      </p>
      {multi ? (
        <div className="flex flex-wrap items-center gap-2">
          {parts.map((part, index) => (
            <input
              key={index}
              id={`${id ?? "numeric"}-part-${index}`}
              className={`input w-24 ${
                validation && !validation.ok
                  ? "ring-2 ring-[var(--bad)] focus:ring-[var(--bad)]"
                  : ""
              }`}
              inputMode="decimal"
              autoComplete="off"
              value={part}
              disabled={disabled}
              placeholder={String(index + 1)}
              onChange={(e) => updatePart(index, e.target.value)}
              onKeyDown={(e) => onPartKeyDown(index, e)}
              onBlur={() => setBlurred(true)}
            />
          ))}
        </div>
      ) : (
        <input
          id={id}
          className={`input ${
            validation && !validation.ok
              ? "ring-2 ring-[var(--bad)] focus:ring-[var(--bad)]"
              : ""
          }`}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          disabled={disabled}
          placeholder="Tulis angka…"
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setBlurred(true)}
        />
      )}
      {validation && !validation.ok ? (
        <p className="text-xs text-[var(--bad)]">{validation.hint}</p>
      ) : null}
    </div>
  );
}
