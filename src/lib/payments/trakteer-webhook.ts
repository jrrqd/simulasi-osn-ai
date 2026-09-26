/**
 * Parse Trakteer webhook JSON into a normalized tip event.
 * Real payloads vary: flat or `{ data }`, `order_id` vs `transaction_id`,
 * `type: tip` vs `new-tip-success`, `price` as number or "Rp 50.000".
 */

export type TrakteerTipEvent = {
  orderId: string;
  amountIdr: number;
  quantity: number;
  message: string;
  isSuccess: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Flatten common Trakteer envelopes so field lookup is one-level. */
export function flattenTrakteerBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const data = asRecord(body.data);
  const result = asRecord(body.result);
  return {
    ...(data ?? {}),
    ...(result ?? {}),
    ...body,
  };
}

export function parseAmountIdr(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.round(raw);
  }
  if (typeof raw !== "string") return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  // "Rp 50.000" / "50.000" / "50000" → digits only (ID thousand separators)
  const digits = trimmed.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function extractEmail(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  );
  return match?.[0]?.toLowerCase() ?? null;
}

/** Scan message fields and any string values in the payload for an email. */
export function extractEmailFromPayload(
  flat: Record<string, unknown>,
): string | null {
  const preferred = [
    flat.supporter_message,
    flat.support_message,
    flat.message,
    flat.supporter_email,
    flat.email,
    flat.donator_email,
  ];
  for (const value of preferred) {
    const email = extractEmail(typeof value === "string" ? value : null);
    if (email) return email;
  }
  for (const value of Object.values(flat)) {
    if (typeof value !== "string") continue;
    const email = extractEmail(value);
    if (email) return email;
  }
  return null;
}

export function isTrakteerSuccess(flat: Record<string, unknown>): boolean {
  const status = String(flat.status ?? "").toLowerCase();
  if (
    status === "success" ||
    status === "succeeded" ||
    status === "paid" ||
    status === "settlement"
  ) {
    return true;
  }
  const type = String(flat.type ?? flat.event ?? "").toLowerCase();
  if (!type) {
    // Some dashboard tests omit type but still send tip fields.
    return Boolean(
      flat.order_id ||
        flat.orderId ||
        flat.transaction_id ||
        flat.price ||
        flat.amount,
    );
  }
  return (
    type === "tip" ||
    type === "donation" ||
    type.includes("success") ||
    type.includes("new-tip") ||
    type.includes("tip")
  );
}

function resolveOrderId(flat: Record<string, unknown>): string {
  return String(
    flat.order_id ??
      flat.orderId ??
      flat.transaction_id ??
      flat.transactionId ??
      flat.id ??
      "",
  ).trim();
}

/**
 * Trakteer `price` is usually the total (number or "Rp …").
 * If it looks like a unit price and quantity multiplies to VIP minimum, use total.
 */
export function resolveAmountIdr(
  flat: Record<string, unknown>,
  minVipAmount: number,
): number {
  const quantityRaw = Number(flat.quantity ?? flat.qty ?? 1);
  const quantity =
    Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;

  const candidates = [
    flat.amount,
    flat.price,
    flat.amount_idr,
    flat.nominal,
    flat.gross_amount,
    flat.net_amount,
    flat.amount_raw,
  ].map(parseAmountIdr);

  let best = Math.max(0, ...candidates);
  if (best <= 0) return 0;

  // Unit × qty: e.g. price Rp 5.000 × quantity 10 → 50.000
  if (best < minVipAmount && best * quantity >= minVipAmount) {
    best = best * quantity;
  }

  return best;
}

export function parseTrakteerTipEvent(
  body: Record<string, unknown>,
  minVipAmount: number,
): TrakteerTipEvent {
  const flat = flattenTrakteerBody(body);
  const quantityRaw = Number(flat.quantity ?? flat.qty ?? 1);
  const quantity =
    Number.isFinite(quantityRaw) && quantityRaw > 0
      ? Math.round(quantityRaw)
      : 1;
  const message = String(
    flat.supporter_message ??
      flat.support_message ??
      flat.message ??
      "",
  );

  return {
    orderId: resolveOrderId(flat),
    amountIdr: resolveAmountIdr(flat, minVipAmount),
    quantity,
    message,
    isSuccess: isTrakteerSuccess(flat),
  };
}
