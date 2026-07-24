import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export async function getSession() {
  try {
    const auth = await getAuth();
    const incoming = await headers();
    const cookieStore = await cookies();

    // Next may omit/empty the Cookie header in RSC while still populating
    // cookies(). Rebuild from the store when needed, re-encoding values so
    // signed Better Auth cookies stay valid.
    const fromHeader = incoming.get("cookie");
    const fromStore = cookieStore
      .getAll()
      .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
      .join("; ");
    const cookieHeader =
      fromHeader && fromHeader.trim().length > 0 ? fromHeader : fromStore;

    if (!cookieHeader) return null;

    const sessionHeaders = new Headers();
    sessionHeaders.set("cookie", cookieHeader);
    const host = incoming.get("host");
    const xfHost = incoming.get("x-forwarded-host");
    const xfProto = incoming.get("x-forwarded-proto");
    if (host) sessionHeaders.set("host", host);
    if (xfHost) sessionHeaders.set("x-forwarded-host", xfHost);
    if (xfProto) sessionHeaders.set("x-forwarded-proto", xfProto);

    const session = await auth.api.getSession({
      headers: sessionHeaders,
    });
    if (!session?.user) return null;
    return session;
  } catch (err) {
    console.error("[getSession]", err);
    return null;
  }
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

export async function requireAdmin() {
  const sessionUser = await requireUser();
  if (sessionUser.role !== "admin") {
    redirect("/study");
  }
  return sessionUser;
}
