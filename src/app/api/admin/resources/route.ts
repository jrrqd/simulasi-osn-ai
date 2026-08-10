import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getDb } from "@/db";
import { ioaiResources } from "@/db/schema";
import { requireApiAdmin, rateLimit } from "@/lib/api";
import {
  buildIoaiReferenceContext,
  listIoaiResourceRecords,
} from "@/lib/content/ioai-resources";
import {
  IOAI_CATEGORIES,
  IOAI_DOMAINS,
  type IoaiResourceCategory,
  type IoaiDomain,
} from "@/lib/content/resource-types";
import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";

const SYLLABUS_TOPICS = new Set(Object.keys(TOPIC_LABELS));

const resourceBodySchema = z.object({
  id: z.string().trim().min(2).max(120).optional(),
  category: z.enum(
    IOAI_CATEGORIES as [IoaiResourceCategory, ...IoaiResourceCategory[]],
  ),
  title: z.string().trim().min(2).max(240),
  url: z.string().trim().url().max(2000),
  summary: z.string().trim().min(5).max(200),
  region: z.string().trim().max(80).optional().nullable(),
  year: z.coerce.number().int().min(2000).max(2100).optional().nullable(),
  domains: z
    .array(z.enum(IOAI_DOMAINS as [IoaiDomain, ...IoaiDomain[]]))
    .default([]),
  topics: z
    .array(z.string().trim())
    .default([])
    .refine((topics) => topics.every((t) => SYLLABUS_TOPICS.has(t)), {
      message: "Topic harus slug silabus resmi",
    }),
  promptHint: z.string().trim().max(500).optional().nullable(),
  hidden: z.boolean().optional(),
});

function slugifyId(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `ioai-admin-${base || "resource"}-${nanoid(6)}`;
}

export async function GET(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(req.url);
  const previewTopic = searchParams.get("previewTopic");
  if (previewTopic) {
    const trackRaw = searchParams.get("track");
    const track =
      trackRaw === "A" ||
      trackRaw === "B" ||
      trackRaw === "C" ||
      trackRaw === "D"
        ? (trackRaw as TrackId)
        : undefined;
    const phase =
      searchParams.get("phase") === "semifinal" ? "semifinal" : "final";
    const preview = await buildIoaiReferenceContext({
      phase,
      track,
      topic: previewTopic,
    });
    return Response.json({ preview, phase, topic: previewTopic, track });
  }

  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const category = searchParams.get("category") ?? "";
  const topic = searchParams.get("topic") ?? "";
  const hiddenParam = searchParams.get("hidden");

  let rows = await listIoaiResourceRecords();

  if (category && IOAI_CATEGORIES.includes(category as IoaiResourceCategory)) {
    rows = rows.filter((r) => r.category === category);
  }
  if (topic) {
    rows = rows.filter((r) => r.topics.includes(topic));
  }
  if (hiddenParam === "true") {
    rows = rows.filter((r) => r.hidden);
  } else if (hiddenParam === "false") {
    rows = rows.filter((r) => !r.hidden);
  }
  if (q) {
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        (r.region ?? "").toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
  }

  return Response.json({
    resources: rows,
    meta: {
      categories: IOAI_CATEGORIES,
      domains: IOAI_DOMAINS,
      topics: Object.entries(TOPIC_LABELS).map(([id, label]) => ({
        id,
        label,
        track: (Object.keys(TRACKS) as TrackId[]).find((t) =>
          TRACKS[t].topics.includes(id),
        ),
      })),
    },
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`admin-resources:${authResult.user.id}`, 60)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const parsed = resourceBodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const id = data.id?.trim() || slugifyId(data.title);
  const db = await getDb();
  const existing = await db.query.ioaiResources.findFirst({
    where: eq(ioaiResources.id, id),
    columns: { id: true },
  });
  if (existing) {
    return Response.json({ error: "ID sudah dipakai" }, { status: 409 });
  }

  const now = new Date();
  await db.insert(ioaiResources).values({
    id,
    category: data.category,
    title: data.title,
    url: data.url,
    summary: data.summary,
    region: data.region?.trim() || null,
    year: data.year ?? null,
    domains: data.domains,
    topics: data.topics,
    promptHint: data.promptHint?.trim() || null,
    source: "admin",
    hidden: data.hidden === true,
    updatedBy: authResult.user.id,
    updatedAt: now,
  });

  return Response.json({ ok: true, id });
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`admin-resources:${authResult.user.id}`, 60)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const id = String(body.id ?? "").trim();
  if (!id) {
    return Response.json({ error: "id wajib" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.query.ioaiResources.findFirst({
    where: eq(ioaiResources.id, id),
  });
  if (!existing) {
    return Response.json({ error: "Resource tidak ditemukan" }, { status: 404 });
  }

  // Allow hide-only patches without full body validation
  if (
    body.hidden !== undefined &&
    Object.keys(body).every((k) => k === "id" || k === "hidden")
  ) {
    await db
      .update(ioaiResources)
      .set({
        hidden: body.hidden === true,
        updatedBy: authResult.user.id,
        updatedAt: new Date(),
      })
      .where(eq(ioaiResources.id, id));
    return Response.json({ ok: true, id });
  }

  const parsed = resourceBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  await db
    .update(ioaiResources)
    .set({
      category: data.category,
      title: data.title,
      url: data.url,
      summary: data.summary,
      region: data.region?.trim() || null,
      year: data.year ?? null,
      domains: data.domains,
      topics: data.topics,
      promptHint: data.promptHint?.trim() || null,
      hidden: data.hidden ?? existing.hidden,
      updatedBy: authResult.user.id,
      updatedAt: new Date(),
    })
    .where(eq(ioaiResources.id, id));

  return Response.json({ ok: true, id });
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`admin-resources:${authResult.user.id}`, 60)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") ?? "").trim();
  if (!id) {
    return Response.json({ error: "id wajib" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.query.ioaiResources.findFirst({
    where: eq(ioaiResources.id, id),
  });
  if (!existing) {
    return Response.json({ error: "Resource tidak ditemukan" }, { status: 404 });
  }

  if (existing.source === "admin") {
    await db.delete(ioaiResources).where(eq(ioaiResources.id, id));
    return Response.json({ ok: true, deleted: true, id });
  }

  // Curated: soft-hide only
  await db
    .update(ioaiResources)
    .set({
      hidden: true,
      updatedBy: authResult.user.id,
      updatedAt: new Date(),
    })
    .where(eq(ioaiResources.id, id));

  return Response.json({ ok: true, hidden: true, id });
}
