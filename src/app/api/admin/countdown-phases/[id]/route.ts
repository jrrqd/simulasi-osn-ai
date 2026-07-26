import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { countdownPhases } from "@/db/schema";
import { requireApiAdmin, rateLimit } from "@/lib/api";
import { isValidIsoInstant } from "@/lib/countdown-phases";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`admin-countdown:${authResult.user.id}`, 60)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const { id } = await ctx.params;
  const db = await getDb();
  const existing = await db.query.countdownPhases.findFirst({
    where: eq(countdownPhases.id, id),
  });
  if (!existing) {
    return Response.json({ error: "Fase tidak ditemukan" }, { status: 404 });
  }

  const body = await req.json();
  const label = String(body.label ?? existing.label).trim();
  const dateLabel = String(body.dateLabel ?? existing.dateLabel).trim();
  const at = String(body.at ?? existing.at).trim();
  const endsAtRaw =
    body.endsAt === undefined
      ? existing.endsAt
      : body.endsAt == null || String(body.endsAt).trim() === ""
        ? null
        : String(body.endsAt).trim();
  const endsAt = endsAtRaw;
  const enabled =
    typeof body.enabled === "boolean" ? body.enabled : existing.enabled;
  const sortOrder = Number.isFinite(Number(body.sortOrder))
    ? Math.trunc(Number(body.sortOrder))
    : existing.sortOrder;

  if (!label || !dateLabel || !at) {
    return Response.json(
      { error: "Label, tanggal tampilan, dan waktu mulai wajib diisi" },
      { status: 400 },
    );
  }
  if (!isValidIsoInstant(at)) {
    return Response.json(
      { error: "Format waktu mulai tidak valid" },
      { status: 400 },
    );
  }
  if (endsAt && !isValidIsoInstant(endsAt)) {
    return Response.json(
      { error: "Format waktu selesai tidak valid" },
      { status: 400 },
    );
  }
  if (endsAt && Date.parse(endsAt) <= Date.parse(at)) {
    return Response.json(
      { error: "Waktu selesai harus setelah waktu mulai" },
      { status: 400 },
    );
  }

  await db
    .update(countdownPhases)
    .set({
      label,
      dateLabel,
      at,
      endsAt,
      sortOrder,
      enabled,
      updatedBy: authResult.user.id,
      updatedAt: new Date(),
    })
    .where(eq(countdownPhases.id, id));

  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`admin-countdown:${authResult.user.id}`, 60)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const { id } = await ctx.params;
  const db = await getDb();
  const existing = await db.query.countdownPhases.findFirst({
    where: eq(countdownPhases.id, id),
  });
  if (!existing) {
    return Response.json({ error: "Fase tidak ditemukan" }, { status: 404 });
  }

  await db.delete(countdownPhases).where(eq(countdownPhases.id, id));
  return Response.json({ ok: true });
}
