import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { countdownPhases } from "@/db/schema";
import { requireApiAdmin, rateLimit } from "@/lib/api";
import { listAdminCountdownPhases } from "@/lib/countdown-phases";
import {
  SELEKSI_PHASES,
  isValidIsoInstant,
  slugifyPhaseId,
} from "@/lib/seleksi-phases";

export async function GET(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const rows = await listAdminCountdownPhases();
  return Response.json({
    phases: rows.map((row) => ({
      id: row.id,
      label: row.label,
      dateLabel: row.dateLabel,
      at: row.at,
      endsAt: row.endsAt,
      sortOrder: row.sortOrder,
      enabled: row.enabled,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`admin-countdown:${authResult.user.id}`, 60)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();

  if (body?.seedDefaults === true) {
    const db = await getDb();
    const existing = await listAdminCountdownPhases();
    if (existing.length > 0) {
      return Response.json(
        { error: "Sudah ada fase. Hapus dulu atau edit satu per satu." },
        { status: 409 },
      );
    }
    const now = new Date();
    await db.insert(countdownPhases).values(
      SELEKSI_PHASES.map((phase, index) => ({
        id: phase.id,
        label: phase.label,
        dateLabel: phase.dateLabel,
        at: phase.at,
        endsAt: phase.endsAt ?? null,
        sortOrder: index,
        enabled: true,
        updatedBy: authResult.user.id,
        updatedAt: now,
        createdAt: now,
      })),
    );
    return Response.json({ ok: true, seeded: SELEKSI_PHASES.length });
  }

  const label = String(body.label ?? "").trim();
  const dateLabel = String(body.dateLabel ?? "").trim();
  const at = String(body.at ?? "").trim();
  const endsAtRaw = body.endsAt == null ? "" : String(body.endsAt).trim();
  const endsAt = endsAtRaw || null;
  const enabled = body.enabled !== false;
  const sortOrder = Number.isFinite(Number(body.sortOrder))
    ? Math.trunc(Number(body.sortOrder))
    : 0;

  if (!label || !dateLabel || !at) {
    return Response.json(
      { error: "Label, tanggal tampilan, dan waktu mulai wajib diisi" },
      { status: 400 },
    );
  }
  if (!isValidIsoInstant(at)) {
    return Response.json(
      { error: "Format waktu mulai tidak valid (pakai ISO, mis. 2026-07-30T00:00:00+07:00)" },
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

  const requestedId = slugifyPhaseId(String(body.id ?? ""));
  const id = requestedId || `phase-${nanoid(8)}`;

  const db = await getDb();
  const clash = await db.query.countdownPhases.findFirst({
    where: eq(countdownPhases.id, id),
  });
  if (clash) {
    return Response.json({ error: "ID fase sudah dipakai" }, { status: 409 });
  }

  const now = new Date();
  await db.insert(countdownPhases).values({
    id,
    label,
    dateLabel,
    at,
    endsAt,
    sortOrder,
    enabled,
    updatedBy: authResult.user.id,
    updatedAt: now,
    createdAt: now,
  });

  return Response.json({ ok: true, id });
}
