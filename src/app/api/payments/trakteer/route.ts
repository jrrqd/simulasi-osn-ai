import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimit } from "@/lib/api";
import { trakteerPayments, user } from "@/db/schema";
import {
  grantVipMembership,
  VIP_PRICE_IDR,
} from "@/lib/user/set-user-type";
import { sendVipConfirmationEmail } from "@/lib/email/send";
import {
  extractEmailFromPayload,
  flattenTrakteerBody,
  parseTrakteerTipEvent,
} from "@/lib/payments/trakteer-webhook";

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

  const minAmount = Number(process.env.VIP_PRICE_IDR ?? VIP_PRICE_IDR);
  const event = parseTrakteerTipEvent(body, minAmount);
  const flat = flattenTrakteerBody(body);

  if (!event.isSuccess) {
    console.info("[trakteer] ignored non-success", {
      type: flat.type,
      status: flat.status,
    });
    return Response.json({ ok: true, ignored: true, reason: "not_success" });
  }

  if (!event.orderId) {
    console.warn("[trakteer] order_id missing", {
      keys: Object.keys(flat),
    });
    return Response.json({ error: "order_id missing" }, { status: 400 });
  }

  if (event.amountIdr < minAmount) {
    console.warn("[trakteer] amount below VIP price", {
      orderId: event.orderId,
      amountIdr: event.amountIdr,
      quantity: event.quantity,
      price: flat.price,
      type: flat.type,
    });
    return Response.json({
      ok: true,
      ignored: true,
      reason: "amount_below_vip_price",
      amountIdr: event.amountIdr,
    });
  }

  const db = await getDb();
  const existing = await db.query.trakteerPayments.findFirst({
    where: eq(trakteerPayments.orderId, event.orderId),
  });
  if (existing) {
    return Response.json({ ok: true, duplicate: true });
  }

  const email = extractEmailFromPayload(flat);

  if (!email) {
    await db.insert(trakteerPayments).values({
      orderId: event.orderId,
      userId: null,
      amountIdr: event.amountIdr,
      supporterMessage: event.message || null,
      raw: body,
    });
    console.warn("[trakteer] no email in payload; orphan payment", {
      orderId: event.orderId,
      amountIdr: event.amountIdr,
    });
    return Response.json({
      ok: true,
      orphan: true,
      reason: "email_not_found_in_message",
    });
  }

  const [account] = await db
    .select()
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`)
    .limit(1);

  if (!account) {
    await db.insert(trakteerPayments).values({
      orderId: event.orderId,
      userId: null,
      amountIdr: event.amountIdr,
      supporterMessage: event.message || null,
      raw: body,
    });
    console.warn("[trakteer] no user for email", {
      orderId: event.orderId,
      email,
    });
    return Response.json({
      ok: true,
      orphan: true,
      reason: "user_not_found",
      email,
    });
  }

  const granted = await grantVipMembership(account.id);
  await db.insert(trakteerPayments).values({
    orderId: event.orderId,
    userId: account.id,
    amountIdr: event.amountIdr,
    supporterMessage: event.message || null,
    raw: body,
  });

  if (granted.ok) {
    void sendVipConfirmationEmail({
      to: account.email,
      name: account.name,
      vipExpiresAt: granted.vipExpiresAt,
    });
    console.info("[trakteer] VIP granted", {
      orderId: event.orderId,
      userId: account.id,
      vipExpiresAt: granted.vipExpiresAt.toISOString(),
      amountIdr: event.amountIdr,
    });
  } else {
    console.warn("[trakteer] grant failed", {
      orderId: event.orderId,
      error: granted.error,
    });
  }

  return Response.json({
    ok: true,
    userId: account.id,
    vipExpiresAt: granted.ok ? granted.vipExpiresAt.toISOString() : null,
  });
}
