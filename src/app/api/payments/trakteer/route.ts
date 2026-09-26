import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimit } from "@/lib/api";
import { trakteerPayments, user } from "@/db/schema";
import {
  grantVipMembership,
  VIP_PRICE_IDR,
} from "@/lib/user/set-user-type";
import { sendVipConfirmationEmail } from "@/lib/email/send";

function parseAmountIdr(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  if (typeof raw !== "string") return 0;
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function extractEmail(message: string | null | undefined): string | null {
  if (!message) return null;
  const match = message.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  );
  return match?.[0]?.toLowerCase() ?? null;
}

function tokenMatches(provided: string, expected: string) {
  const actualHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function isSuccessPayload(body: Record<string, unknown>): boolean {
  const status = String(body.status ?? "").toLowerCase();
  const type = String(body.type ?? body.event ?? "").toLowerCase();
  if (status === "success" || status === "succeeded" || status === "paid") {
    return true;
  }
  return (
    type.includes("success") ||
    type.includes("new-tip") ||
    type === "donation"
  );
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`trakteer:${clientIp(req)}`, 30, 60_000)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
  const expected = process.env.TRAKTEER_WEBHOOK_TOKEN?.trim();
  if (!expected) {
    console.error("[trakteer] TRAKTEER_WEBHOOK_TOKEN not configured");
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const token = req.headers.get("x-webhook-token")?.trim() ?? "";
  if (!token || !tokenMatches(token, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isSuccessPayload(body)) {
    return Response.json({ ok: true, ignored: true, reason: "not_success" });
  }

  const orderId = String(
    body.order_id ?? body.orderId ?? body.id ?? "",
  ).trim();
  if (!orderId) {
    return Response.json({ error: "order_id missing" }, { status: 400 });
  }

  const amountIdr = parseAmountIdr(
    body.amount ?? body.price ?? body.amount_idr ?? body.nominal,
  );
  const minAmount = Number(process.env.VIP_PRICE_IDR ?? VIP_PRICE_IDR);
  if (amountIdr < minAmount) {
    console.warn("[trakteer] amount below VIP price", { orderId, amountIdr });
    return Response.json({
      ok: true,
      ignored: true,
      reason: "amount_below_vip_price",
      amountIdr,
    });
  }

  const db = await getDb();
  const existing = await db.query.trakteerPayments.findFirst({
    where: eq(trakteerPayments.orderId, orderId),
  });
  if (existing) {
    return Response.json({ ok: true, duplicate: true });
  }

  const message = String(
    body.supporter_message ?? body.support_message ?? body.message ?? "",
  );
  const email =
    extractEmail(message) ||
    extractEmail(String(body.supporter_email ?? body.email ?? ""));

  if (!email) {
    await db.insert(trakteerPayments).values({
      orderId,
      userId: null,
      amountIdr,
      supporterMessage: message || null,
      raw: body,
    });
    console.warn("[trakteer] no email in message; orphan payment", orderId);
    return Response.json({
      ok: true,
      orphan: true,
      reason: "email_not_found_in_message",
    });
  }

  const account = await db.query.user.findFirst({
    where: eq(user.email, email),
  });
  if (!account) {
    await db.insert(trakteerPayments).values({
      orderId,
      userId: null,
      amountIdr,
      supporterMessage: message || null,
      raw: body,
    });
    console.warn("[trakteer] no user for payment", orderId);
    return Response.json({
      ok: true,
      orphan: true,
      reason: "user_not_found",
    });
  }

  const granted = await grantVipMembership(account.id);
  await db.insert(trakteerPayments).values({
    orderId,
    userId: account.id,
    amountIdr,
    supporterMessage: message || null,
    raw: body,
  });

  if (granted.ok) {
    void sendVipConfirmationEmail({
      to: account.email,
      name: account.name,
      vipExpiresAt: granted.vipExpiresAt,
    });
  }

  return Response.json({
    ok: true,
    vipExpiresAt: granted.ok ? granted.vipExpiresAt.toISOString() : null,
  });
}
