import { NextRequest } from "next/server";
import { requireApiAdmin, rateLimit } from "@/lib/api";
import {
  describeNewsSchedule,
  getNewsFeedSettings,
  recordNewsRefreshResult,
  saveNewsFeedSettings,
} from "@/lib/news/settings";
import { refreshNewsFromRss } from "@/lib/news-feed";

export async function GET(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const settings = await getNewsFeedSettings();
  return Response.json({
    ...settings,
    scheduleLabel: describeNewsSchedule(
      settings.intervalHours,
      settings.anchorHourWib,
    ),
  });
}

export async function PUT(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`admin-news:${authResult.user.id}`, 30)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  try {
    const settings = await saveNewsFeedSettings({
      keywords: body.keywords,
      intervalHours: body.intervalHours,
      anchorHourWib: body.anchorHourWib,
      enabled: body.enabled !== false,
      updatedBy: authResult.user.id,
    });
    return Response.json({
      ok: true,
      ...settings,
      scheduleLabel: describeNewsSchedule(
        settings.intervalHours,
        settings.anchorHourWib,
      ),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan" },
      { status: 400 },
    );
  }
}

/** Force refresh now (ignores schedule; still respects saved keywords). */
export async function POST(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`admin-news-refresh:${authResult.user.id}`, 5)) {
    return Response.json(
      { error: "Terlalu banyak refresh — coba lagi nanti" },
      { status: 429 },
    );
  }

  try {
    const result = await refreshNewsFromRss();
    const message = `inserted=${result.inserted} skipped=${result.skipped} errors=${result.errors.length}`;
    await recordNewsRefreshResult({
      ok: result.errors.length === 0,
      message,
    });
    const settings = await getNewsFeedSettings();
    return Response.json({
      ok: true,
      result,
      ...settings,
      scheduleLabel: describeNewsSchedule(
        settings.intervalHours,
        settings.anchorHourWib,
      ),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Refresh gagal";
    await recordNewsRefreshResult({ ok: false, message: msg });
    return Response.json({ error: msg }, { status: 500 });
  }
}
