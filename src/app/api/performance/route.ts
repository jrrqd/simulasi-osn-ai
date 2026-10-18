import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api";
import { getPerformanceData } from "@/lib/analytics/performance-data";

export async function GET(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  const data = await getPerformanceData(authResult.user.id);
  return Response.json(data);
}
