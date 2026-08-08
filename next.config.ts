import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BUILD_ID = (() => {
  try {
    return readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return "dev";
  }
})();

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS is owned by nginx (single source of truth at the edge); do not duplicate here.
];

const BASE_HEADERS = [
  ...SECURITY_HEADERS,
  { key: "X-Build-Id", value: BUILD_ID },
];

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  serverExternalPackages: [
    "postgres",
    "better-auth",
    "@better-auth/drizzle-adapter",
    "@electric-sql/pglite",
  ],
  async headers() {
    return [
      // HTML pages: never cache at the browser. force-dynamic + session-aware
      // responses would otherwise stay stale until hard reload.
      {
        source: "/:path*",
        has: [
          {
            type: "header",
            key: "Accept",
            value: "(?<g>.*text/html.*)",
          },
        ],
        headers: [
          ...BASE_HEADERS,
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
        ],
      },
      // Static assets served from /_next/* and /public/* (matched in nginx,
      // not from Next.js, but listed for completeness when running standalone).
      {
        source: "/_next/static/:path*",
        headers: [
          ...BASE_HEADERS,
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Fallback for any other path: never cache by default.
      {
        source: "/:path*",
        headers: [
          ...BASE_HEADERS,
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;