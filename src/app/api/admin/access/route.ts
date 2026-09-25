import { NextRequest } from "next/server";
import { requireApiAdmin, rateLimit } from "@/lib/api";
import {
  ACCESS_FEATURES,
  ACCESS_TIERS,
  ACCESS_TIER_LABELS,
  normalizeAccessMatrix,
  type AccessFeatureFlags,
  type AccessTier,
} from "@/lib/access/catalog";
import { getAccessMatrix, saveAccessMatrix } from "@/lib/access/matrix";

export async function GET(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const matrix = await getAccessMatrix();
  return Response.json({
    tiers: ACCESS_TIERS,
    tierLabels: ACCESS_TIER_LABELS,
    features: ACCESS_FEATURES,
    matrix,
  });
}

export async function PUT(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`admin-access:${authResult.user.id}`, 30)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const raw = body?.matrix;
  if (!raw || typeof raw !== "object") {
    return Response.json({ error: "matrix wajib diisi" }, { status: 400 });
  }

  const input: Partial<Record<AccessTier, Partial<AccessFeatureFlags>>> = {};
  for (const tier of ACCESS_TIERS) {
    const row = raw[tier];
    if (row && typeof row === "object") {
      input[tier] = row as Partial<AccessFeatureFlags>;
    }
  }

  // Preview normalize so we reject nothing unexpected silently; always save.
  normalizeAccessMatrix(input);
  const matrix = await saveAccessMatrix(input);
  return Response.json({
    ok: true,
    matrix,
    features: ACCESS_FEATURES,
    tiers: ACCESS_TIERS,
    tierLabels: ACCESS_TIER_LABELS,
  });
}
