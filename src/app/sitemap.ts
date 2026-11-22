import type { MetadataRoute } from "next";

import { CONTENT_UPDATED_AT, siteUrl } from "./_seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  return [
    {
      url: `${base}/`,
      lastModified: CONTENT_UPDATED_AT,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${base}/privacy`,
      lastModified: CONTENT_UPDATED_AT,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
