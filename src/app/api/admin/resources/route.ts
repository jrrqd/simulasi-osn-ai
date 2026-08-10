import { NextRequest } from "next/server";
import { requireApiAdmin, rateLimit } from "@/lib/api";
import {
  listAdminIoaiResources,
  upsertAdminIoaiResource,
  setIoaiResourceHidden,
} from "@/lib/content/ioai-resources";
import {
  IOAI_CATEGORIES,
  IOAI_DOMAINS,
  type IoaiDomain,
  type IoaiResourceCategory,
} from "@/lib/content/resource-types";

export async function GET(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const resources = await listAdminIoaiResources();
  return Response.json({ resources });
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`admin-ioai-resources:${authResult.user.id}`, 60)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const id = String(body.id ?? "").trim();
  const title = String(body.title ?? "").trim();
  const url = String(body.url ?? "").trim();
  const summary = String(body.summary ?? "").trim();
  const category = String(body.category ?? "").trim() as IoaiResourceCategory;

  if (!id || !title || !url || !summary) {
    return Response.json(
      { error: "id, title, url, dan summary wajib diisi" },
      { status: 400 },
    );
  }
  if (!(IOAI_CATEGORIES as string[]).includes(category)) {
    return Response.json({ error: "Kategori tidak valid" }, { status: 400 });
  }

  const domains = Array.isArray(body.domains)
    ? body.domains.filter(
        (d: unknown): d is IoaiDomain =>
          typeof d === "string" && (IOAI_DOMAINS as string[]).includes(d),
      )
    : [];
  const topics = Array.isArray(body.topics)
    ? body.topics.map(String).filter(Boolean)
    : [];
  const yearRaw = body.year == null || body.year === "" ? null : Number(body.year);
  const year =
    yearRaw != null && Number.isFinite(yearRaw) ? Math.trunc(yearRaw) : null;

  const resource = await upsertAdminIoaiResource(
    {
      id,
      category,
      title,
      url,
      region: body.region ? String(body.region).trim() : null,
      year,
      domains,
      topics,
      summary,
      promptHint: body.promptHint ? String(body.promptHint).trim() : null,
      hidden: Boolean(body.hidden),
    },
    authResult.user.id,
  );

  return Response.json({ resource });
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`admin-ioai-resources-patch:${authResult.user.id}`, 60)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const id = String(body.id ?? "").trim();
  if (!id) {
    return Response.json({ error: "id wajib" }, { status: 400 });
  }

  if (typeof body.hidden === "boolean") {
    const ok = await setIoaiResourceHidden(id, body.hidden, authResult.user.id);
    if (!ok) {
      return Response.json({ error: "Resource tidak ditemukan" }, { status: 404 });
    }
    return Response.json({ ok: true, id, hidden: body.hidden });
  }

  return Response.json({ error: "Tidak ada field yang diubah" }, { status: 400 });
}
