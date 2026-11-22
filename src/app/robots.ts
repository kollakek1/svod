import type { MetadataRoute } from "next";

import { siteUrl } from "./_seo/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Админка, API и превью не должны попадать в индекс.
        disallow: ["/admin", "/api", "/preview"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: new URL(base).host,
  };
}
