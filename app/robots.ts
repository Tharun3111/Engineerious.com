import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { CLOSED_PUBLIC_PREFIXES, DEFERRED_PUBLIC_PREFIXES } from "@/lib/public-launch";

export default function robots(): MetadataRoute.Robots {
  const site = env.siteUrl.replace(/\/$/, "");

  // Must track proxy.ts's gate exactly. Disallowing a path that 200s (or
  // allowing one that 404s) both misinform crawlers. Read the prefixes from
  // lib/public-launch rather than restating them: this list had already drifted
  // out of sync with the routes actually being served.
  const closedPaths = [...CLOSED_PUBLIC_PREFIXES];
  const gatedPaths = [...DEFERRED_PUBLIC_PREFIXES];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          ...closedPaths,
          ...(env.publicResearchEnabled ? [] : gatedPaths),
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
