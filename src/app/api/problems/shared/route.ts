import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api";
import { listSharedProblems } from "@/lib/content/shared";

export async function GET(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;

  const url = new URL(req.url);
  const track = url.searchParams.get("track") ?? undefined;
  const topic = url.searchParams.get("topic") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const problems = await listSharedProblems({ track, topic, limit, offset });
  return Response.json({ problems });
}
