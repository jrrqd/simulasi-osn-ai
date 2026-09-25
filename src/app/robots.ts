import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/seo-public";

const SITE_URL = publicSiteUrl();

const DISALLOW = [
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
];

const ALLOW = ["/", "/llms.txt", "/register", "/berita"];

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
