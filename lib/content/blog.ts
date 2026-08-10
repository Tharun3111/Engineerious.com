import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import matter from "gray-matter";

import { parseFrontmatter, type Frontmatter } from "@/lib/content/frontmatter";

/**
 * MDX-on-disk is the source of truth for blog content. `posts` in Postgres is only a
 * mirror for repurposing bookkeeping (see lib/content/sync.ts).
 *
 * Swapping to a hosted CMS later means reimplementing `getAllPosts`/`getPost` against
 * that API — nothing outside this file reads the filesystem.
 */

const CONTENT_DIR = join(process.cwd(), "content", "blog");

export type { Frontmatter } from "@/lib/content/frontmatter";

export type BlogPost = Frontmatter & {
  slug: string;
  body: string;
  readingMinutes: number;
};

function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 225));
}

function listFiles(): string[] {
  try {
    return readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".mdx"));
  } catch {
    return [];
  }
}

function load(file: string): BlogPost {
  const slug = file.replace(/\.mdx$/, "");
  const raw = readFileSync(join(CONTENT_DIR, file), "utf8");
  const { data, content } = matter(raw);

  const parsed = parseFrontmatter(data, `content/blog/${file}`);

  return {
    ...parsed,
    slug,
    body: content,
    readingMinutes: readingMinutes(content),
  };
}

const includeDrafts = process.env.NODE_ENV !== "production";

export function getAllPosts(): BlogPost[] {
  return listFiles()
    .map(load)
    .filter(
      (post) =>
        includeDrafts || (!post.draft && post.authenticityStatus === "verified"),
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** Public-only view, even in development and tests. */
export function getPublishedPosts(): BlogPost[] {
  return listFiles()
    .map(load)
    .filter((post) => !post.draft && post.authenticityStatus === "verified")
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function getPost(slug: string): BlogPost | null {
  return getAllPosts().find((post) => post.slug === slug) ?? null;
}

export function getPostsByPillar(pillar: string): BlogPost[] {
  return getAllPosts().filter((post) => post.pillar === pillar);
}

export function getAdjacentPosts(slug: string) {
  const posts = getAllPosts();
  const index = posts.findIndex((p) => p.slug === slug);
  return {
    newer: index > 0 ? posts[index - 1] : null,
    older: index >= 0 && index < posts.length - 1 ? posts[index + 1] : null,
  };
}
