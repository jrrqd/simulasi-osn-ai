import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://radr.nxtdev.xyz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          // Auth-gated listing/detail pages — crawlers can't reach them
          // and including them only returns the login redirect.
          "/study",
          "/practice",
          "/mock",
          "/performance",
          "/settings",
          "/review",
          "/onboarding",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
