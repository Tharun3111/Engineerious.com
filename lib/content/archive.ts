import { desc } from "drizzle-orm";

import { digests as digestsTable } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getAllDbPosts, getPublishedPosts, isVisible, type BlogPost } from "@/lib/content/blog";

export type ArchiveDay = { date: string; posts: BlogPost[] };

/**
 * Chicago-anchored digest dates whose post is currently visible. Deliberately does
 * NOT filter the SQL query by digests.status — that column is a date index only,
 * never a second visibility gate (see isVisible() in lib/content/blog.ts for why:
 * the admin approve route writes posts.draft/authenticityStatus and digests.status
 * in separate, non-atomic updates, so trusting digests.status alone can show a
 * post the human never actually finished approving, or hide one that's genuinely
 * live). isVisible(post) — checked per row below — is the only real gate.
 *
 * Fetches the digest rows and the full posts table ONCE and joins in memory,
 * rather than calling getPost() per digest row — that earlier version re-ran a
 * full, unfiltered `select * from posts` for every single digest row (an N+1
 * that re-fires on every /archive, /archive/[date], and /sitemap.xml request).
 */
async function getVisiblePipelineDays(): Promise<{ date: string; post: BlogPost }[]> {
  try {
    const [rows, dbPosts] = await Promise.all([
      getDb()
        .select({ date: digestsTable.date, blogPostSlug: digestsTable.blogPostSlug })
        .from(digestsTable)
        .orderBy(desc(digestsTable.date)),
      getAllDbPosts(),
    ]);
    const bySlug = new Map(dbPosts.map((post) => [post.slug, post]));

    const entries: { date: string; post: BlogPost }[] = [];
    for (const row of rows) {
      if (!row.blogPostSlug) continue;
      const post = bySlug.get(row.blogPostSlug);
      if (post && isVisible(post)) entries.push({ date: row.date, post });
    }
    return entries;
  } catch (error) {
    console.error("[archive] could not load pipeline digest dates:", error);
    return [];
  }
}

/** Human-authored MDX posts only — DB-native posts are already covered via digests.date. */
async function getVisibleMdxDays(): Promise<{ date: string; post: BlogPost }[]> {
  const posts = await getPublishedPosts();
  return posts
    .filter((p) => p.source === "mdx")
    .map((p) => ({ date: p.date.toISOString().slice(0, 10), post: p }));
}

export async function getArchiveIndex(): Promise<ArchiveDay[]> {
  const [pipeline, mdx] = await Promise.all([getVisiblePipelineDays(), getVisibleMdxDays()]);
  const byDate = new Map<string, BlogPost[]>();
  for (const { date, post } of [...pipeline, ...mdx]) {
    const posts = byDate.get(date) ?? [];
    posts.push(post);
    byDate.set(date, posts);
  }
  return Array.from(byDate.entries())
    .map(([date, posts]) => ({ date, posts }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export function isValidArchiveDate(date: string): boolean {
  return DATE_FORMAT.test(date);
}

export async function getArchiveDay(date: string): Promise<BlogPost[] | null> {
  if (!isValidArchiveDate(date)) return null;
  const index = await getArchiveIndex();
  return index.find((d) => d.date === date)?.posts ?? null;
}
