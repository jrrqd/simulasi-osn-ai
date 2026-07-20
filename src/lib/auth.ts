import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as schema from "@/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _auth: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _authPromise: Promise<any> | null = null;
let _bootstrapped = false;

export async function getAuth() {
  if (_auth) return _auth;
  if (_authPromise) return _authPromise;

  _authPromise = (async () => {
    const db = await getDb();
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const auth = betterAuth({
      baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
      secret: process.env.BETTER_AUTH_SECRET,
      database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
          user: schema.user,
          session: schema.session,
          account: schema.account,
          verification: schema.verification,
        },
      }),
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
      },
      session: {
        expiresIn: 60 * 60 * 24 * 30,
        updateAge: 60 * 60 * 24,
      },
      advanced: {
        // HTTP over Tailscale/LAN — Secure cookies would never stick.
        useSecureCookies: false,
      },
      trustedOrigins: [
        ...new Set(
          [
            process.env.BETTER_AUTH_URL,
            process.env.NEXT_PUBLIC_APP_URL,
            ...(process.env.TRUSTED_ORIGINS?.split(",") ?? []),
            "http://localhost:3000",
            "http://127.0.0.1:3000",
          ]
            .filter(Boolean)
            .map((origin) => origin!.trim().replace(/\/$/, "")),
        ),
      ],
      databaseHooks: {
        user: {
          create: {
            before: async (newUser) => ({
              data: {
                ...newUser,
                role: adminEmails.includes(newUser.email.toLowerCase())
                  ? "admin"
                  : "student",
              },
            }),
          },
        },
      },
      plugins: [
        admin({
          defaultRole: "student",
          adminRoles: ["admin"],
        }),
        nextCookies(),
      ],
    });

    _auth = auth;

    if (!_bootstrapped) {
      _bootstrapped = true;
      const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const password = process.env.ADMIN_PASSWORD;
      if (email && password && password.length >= 8) {
        const existing = await db.query.user.findFirst({
          where: eq(schema.user.email, email),
        });
        if (!existing) {
          const created = await auth.api.signUpEmail({
            body: {
              email,
              password,
              name: process.env.ADMIN_NAME ?? "Administrator",
            },
          });
          await db
            .update(schema.user)
            .set({ role: "admin", updatedAt: new Date() })
            .where(eq(schema.user.id, created.user.id));
        } else if (existing.role !== "admin") {
          await db
            .update(schema.user)
            .set({ role: "admin", updatedAt: new Date() })
            .where(eq(schema.user.id, existing.id));
        }
      }
    }

    return auth;
  })().catch((err) => {
    _authPromise = null;
    _auth = null;
    throw err;
  });

  return _authPromise;
}
