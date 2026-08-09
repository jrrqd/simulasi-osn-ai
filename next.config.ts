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
  // Hard ceiling for stale-while-revalidate on any ISR / Cache Components
  // output so an edge proxy never serves stale content indefinitely.
  expireTime: 3600,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    // lucide-react / recharts / react-markdown are barrel-export heavy;
    // this turns named imports into per-module imports at build time.
    optimizePackageImports: ["lucide-react", "recharts", "react-markdown"],
  },
  serverExternalPackages: [
    "postgres",
    "better-auth",
    "@better-auth/drizzle-adapter",
    "@electric-sql/pglite",
  ],
  async headers() {
    return [
      // HTML responses: never cache at the browser. force-dynamic +
      // session-aware pages would otherwise stay stale after a deploy.
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
      // Static assets served from /_next/* (matched in nginx, but listed
      // here so the headers also apply when running without nginx).
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
      // Disable nginx buffering for AI streaming routes (App Router SSE /
      // chunked responses). Without this, chat tokens arrive in bursts.
      {
        source: "/api/ai/:path*",
        headers: [
          ...BASE_HEADERS,
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
    ];
  },
};

export default nextConfig;