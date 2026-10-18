import type { MetadataRoute } from "next";
import { APP_BASE_PATH } from "@/lib/app-path";
import { publicSiteUrl } from "@/lib/seo-public";

const SITE_URL = publicSiteUrl();
const BASE = APP_BASE_PATH.replace(/\/$/, "");

function withBase(paths: string[]): string[] {
  if (!BASE) return paths;
  const out = new Set<string>();
  for (const p of paths) {
    out.add(p);
    out.add(p === "/" ? `${BASE}/` : `${BASE}${p}`);
    if (p === "/") out.add(BASE);
  }
  return [...out];
}

const DISALLOW = withBase([
  "/api/",
  "/admin",
  "/login",
  "/study",
  "/practice",
  "/mock",
  "/performance",
  "/settings",
  "/review",
  "/onboarding",
]);

const ALLOW = withBase(["/", "/llms.txt", "/register", "/berita"]);

/** Shared crawl policy for Google/Bing and major AI crawlers (GEO). */
const RULE = {
  allow: ALLOW,
  disallow: DISALLOW,
};

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", ...RULE },
      // Explicit AI / answer-engine bots — skill seo-geo P1
      { userAgent: "GPTBot", ...RULE },
      { userAgent: "ChatGPT-User", ...RULE },
      { userAgent: "Google-Extended", ...RULE },
      { userAgent: "PerplexityBot", ...RULE },
      { userAgent: "ClaudeBot", ...RULE },
      { userAgent: "anthropic-ai", ...RULE },
      { userAgent: "Bingbot", ...RULE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
