import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export async function getSession() {
  try {
    const auth = await getAuth();
    const incoming = await headers();
    const cookieStore = await cookies();

    // Prefer the raw Cookie header; fall back to Next's cookie store.
    const cookieHeader =
      incoming.get("cookie") ??
      cookieStore
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");

    if (!cookieHeader) return null;

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
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
