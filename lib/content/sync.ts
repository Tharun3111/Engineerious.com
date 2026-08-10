import { eq } from "drizzle-orm";

import { posts } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { BlogPost } from "@/lib/content/blog";

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

export async function setDistribution(slug: string, platform: string, url: string) {
  const existing = await getPostRow(slug);
  const distribution = { ...(existing?.distribution ?? {}), [platform]: url };
  await getDb().update(posts).set({ distribution, updatedAt: new Date() }).where(eq(posts.slug, slug));
  return distribution;
}
