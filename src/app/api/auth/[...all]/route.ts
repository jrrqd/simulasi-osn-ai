import { getAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/api";

const WINDOW_MS = 15 * 60_000;

function clientIp(request: Request) {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function authBucket(pathname: string) {
  if (pathname.includes("request-password-reset") || pathname.includes("forget-password")) {
    return "reset";
  }
  if (pathname.includes("/sign-up/")) return "sign-up";
  if (pathname.includes("/sign-in/")) return "sign-in";
  return null;
}

async function handler(request: Request) {
  if (request.method === "POST") {
    const bucket = authBucket(new URL(request.url).pathname);
    if (bucket) {
      const limit = bucket === "reset" ? 10 : 30;
      if (!rateLimit(`auth:${bucket}:${clientIp(request)}`, limit, WINDOW_MS)) {
        return Response.json(
          { error: "Terlalu banyak percobaan. Coba lagi nanti." },
          { status: 429 },
        );
      }
    }
  }
  const auth = await getAuth();
  return auth.handler(request);
}

export const GET = handler;
export const POST = handler;
