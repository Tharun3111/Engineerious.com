import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const site = env.siteUrl.replace(/\/$/, "");

  // Must track middleware.ts's PUBLIC_RESEARCH_ENABLED gate exactly. Disallowing a
  // path that 200s (or allowing one that 404s) both misinform crawlers.
  const gatedPaths = ["/open-source", "/resources", "/submit", "/pillars"];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          ...(env.publicResearchEnabled ? [] : gatedPaths),
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
