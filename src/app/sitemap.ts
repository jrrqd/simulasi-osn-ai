import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/seo-public";

const SITE_URL = publicSiteUrl();

/** Stable date for crawlers; bump when public copy or URL set changes. */
const LAST_MODIFIED = new Date("2026-09-25T18:00:00+07:00");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/berita`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/register`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
