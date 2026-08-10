import { NextRequest } from "next/server";
import { requireApiAdmin, rateLimit } from "@/lib/api";
import {
  getIoaiGuide,
  listAdminIoaiGuides,
  updateIoaiGuide,
} from "@/lib/content/ioai-guides";

export async function GET(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const guide = await getIoaiGuide(id, { includeHidden: true });
    if (!guide) {
      return Response.json({ error: "Panduan tidak ditemukan" }, { status: 404 });
    }
    return Response.json({ guide });
  }

  const guides = await listAdminIoaiGuides();
  return Response.json({ guides });
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`admin-ioai-guides:${authResult.user.id}`, 60)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const id = String(body.id ?? "").trim();
  if (!id) {
    return Response.json({ error: "id wajib" }, { status: 400 });
  }

  const patch: Parameters<typeof updateIoaiGuide>[1] = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.ringkasan === "string") patch.ringkasan = body.ringkasan;
  if (typeof body.kunciJawaban === "string") {
    patch.kunciJawaban = body.kunciJawaban;
  }
  if (typeof body.pembahasan === "string") patch.pembahasan = body.pembahasan;
  if (typeof body.originalUrl === "string") {
    patch.originalUrl = body.originalUrl.trim();
  }
  if (body.solutionUrl === null) patch.solutionUrl = undefined;
  else if (typeof body.solutionUrl === "string") {
    patch.solutionUrl = body.solutionUrl.trim() || undefined;
  }
  if (typeof body.credit === "string") patch.credit = body.credit.trim();
  if (Array.isArray(body.topics)) {
    patch.topics = body.topics.map(String).filter(Boolean);
  }
  if (typeof body.hidden === "boolean") patch.hidden = body.hidden;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Tidak ada field yang diubah" }, { status: 400 });
  }

  const guide = await updateIoaiGuide(id, patch, authResult.user.id);
  if (!guide) {
    return Response.json({ error: "Panduan tidak ditemukan" }, { status: 404 });
  }
  return Response.json({ guide });
}
