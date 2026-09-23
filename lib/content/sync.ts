import { eq } from "drizzle-orm";

import { posts } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { BlogPost } from "@/lib/content/blog";
import { httpUrlSchema } from "@/lib/editorial-safety";

/**
 * Mirror MDX frontmatter into Postgres so repurpose jobs and distribution links have
 * a stable row to hang off. Called from /api/repurpose — never on a page render.
 */
export async function syncPost(post: BlogPost) {
  const db = getDb();
  const values = {
    slug: post.slug,
    title: post.title,
    dek: post.dek,
    pillar: post.pillar,
    canonical: post.canonical ?? null,
    publishedAt: post.date,
    updatedAt: new Date(),
  };

  const [row] = await db
    .insert(posts)
    .values(values)
    .onConflictDoUpdate({ target: posts.slug, set: values })
    .returning();

  return row;
}

export async function getPostRow(slug: string) {
  try {
    const rows = await getDb().select().from(posts).where(eq(posts.slug, slug)).limit(1);
    return rows[0] ?? null;
  } catch {
    // The blog must render with no database configured at all.
    return null;
  }
}

/** Public detail pages need only this small JSON field, never the article body. */
export async function getPostDistribution(slug: string): Promise<unknown> {
  try {
    const [row] = await getDb()
      .select({ distribution: posts.distribution })
      .from(posts)
      .where(eq(posts.slug, slug))
      .limit(1);
    return row?.distribution ?? null;
  } catch {
    // Distribution is optional; a database outage must not take down an MDX post.
    return null;
  }
}

/**
 * Treat the JSON distribution column as untrusted at every read/write boundary.
 * Old rows predate URL validation, so keep only normalized HTTP(S) destinations.
 */
export function sanitizeDistributionLinks(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const links: Array<[string, string]> = [];
  for (const [platform, rawUrl] of Object.entries(value)) {
    if (typeof rawUrl !== "string") continue;
    const parsed = httpUrlSchema.safeParse(rawUrl.trim());
    if (parsed.success) links.push([platform, parsed.data]);
  }
  return Object.fromEntries(links);
}

export async function setDistribution(slug: string, platform: string, url: string) {
  const parsedUrl = httpUrlSchema.safeParse(url.trim());
  if (!parsedUrl.success) {
    throw new Error("Distribution URL must be an absolute HTTP(S) URL.");
  }

  const existingDistribution = await getPostDistribution(slug);
  const distribution = Object.fromEntries([
    ...Object.entries(sanitizeDistributionLinks(existingDistribution)),
    [platform, parsedUrl.data],
  ]);
  await getDb().update(posts).set({ distribution, updatedAt: new Date() }).where(eq(posts.slug, slug));
  return distribution;
}
