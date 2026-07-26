/** App display timezone: WIB (Western Indonesia Time). */
export const APP_TIME_ZONE = "Asia/Jakarta";
export const APP_LOCALE = "id-ID";

function asDate(value: string | number | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format date+time in WIB for UI. */
export function formatDateTimeWib(
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = asDate(value);
  if (!d) return "—";
  return d.toLocaleString(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    ...options,
  });
}

/** Format date-only in WIB for UI. */
export function formatDateWib(
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = asDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    ...options,
  });
}

/**
 * Format a calendar birth date `YYYY-MM-DD` without shifting the day
 * across timezones (anchor at noon WIB).
 */
export function formatBirthDateWib(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Calendar day key `YYYY-MM-DD` in WIB for charts/aggregations. */
export function dayKeyWib(value: string | number | Date): string {
  const d = asDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
