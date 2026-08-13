import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { desc } from "drizzle-orm";
import matter from "gray-matter";

import { posts as postsTable, type DiagramSpec } from "@/db/schema";
import { getDb } from "@/lib/db";
import { parseFrontmatter, type Frontmatter } from "@/lib/content/frontmatter";
import type { PillarSlug } from "@/lib/pillars";

/**
 * Two sources of truth, merged. Human-written posts are MDX-on-disk (source of
 * truth stays the file). Daily-pipeline auto-generated posts are DB-native — see
 * db/schema.ts's `posts.body` comment for why (Vercel's production filesystem is
 * read-only, so a cron route can't write a new .mdx file at runtime).
 *
 * Every function here is now async because of the DB half — this changed from the
 * original filesystem-only, synchronous version. Every caller was updated to await.
 */

const CONTENT_DIR = join(process.cwd(), "content", "blog");

export type { Frontmatter } from "@/lib/content/frontmatter";

export type BlogPost = Frontmatter & {
  slug: string;
  body: string;
  readingMinutes: number;
  /** Where this post actually lives — mostly diagnostic, not used for rendering logic. */
  source: "mdx" | "db";
  /**
   * DB-native (pipeline) posts only — always undefined for MDX posts. Not part of
   * Frontmatter/frontmatterSchema: MDX authors don't hand-supply these today. See
   * lib/write.ts's writeOutputSchema, the source of truth for all four fields.
   *
   * IMPORTANT: adding a field here does NOT make it appear on a post — it must also
   * be copied explicitly in getAllDbPosts()'s mapped object below. Forgetting that
   * step is a real bug this exact codebase shipped once (Wave 1: tldr/keyFacts were
   * declared here and in the DB, but silently never rendered on any public page
   * because the mapping step was skipped) — TypeScript does not catch it because
   * these fields are optional.
   */
  tldr?: string;
  keyFacts?: string[];
  relevantTickers?: string[];
  diagram?: DiagramSpec;
};

function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 225));
}

function listMdxFiles(): string[] {
  try {
    return readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".mdx"));
  } catch {
    return [];
  }
}

function loadMdx(file: string): BlogPost {
  const slug = file.replace(/\.mdx$/, "");
  const raw = readFileSync(join(CONTENT_DIR, file), "utf8");
  const { data, content } = matter(raw);
  const parsed = parseFrontmatter(data, `content/blog/${file}`);

  return { ...parsed, slug, body: content, readingMinutes: readingMinutes(content), source: "mdx" };
}

function getAllMdxPosts(): BlogPost[] {
  return listMdxFiles().map(loadMdx);
}

/**
 * DB-native posts only — rows where `body` is actually set (a mirror row for an MDX
 * post, written by lib/content/sync.ts, has `body: null` and must not double-render
 * as a second copy of the same post). Exported so callers that need to look up many
 * posts by slug (e.g. lib/content/archive.ts) can fetch once and build a map, rather
 * than calling getPost() per row and re-querying the whole table each time.
 */
export async function getAllDbPosts(): Promise<BlogPost[]> {
  try {
    const rows = await getDb().select().from(postsTable).orderBy(desc(postsTable.publishedAt));
    return rows
      .filter((r) => r.body !== null)
      .map((r) => ({
        title: r.title,
        dek: r.dek ?? "",
        pillar: r.pillar as PillarSlug,
        date: r.publishedAt ?? r.createdAt,
        canonical: r.canonical ?? undefined,
        tags: (r.tags as string[] | null) ?? [],
        draft: r.draft,
        format: (r.format as Frontmatter["format"]) ?? "article",
        origin: (r.origin as Frontmatter["origin"]) ?? "ai_generated",
        sourceStatus: (r.sourceStatus as Frontmatter["sourceStatus"]) ?? "primary",
        testedStatus: (r.testedStatus as Frontmatter["testedStatus"]) ?? "not_tested",
        authenticityStatus: (r.authenticityStatus as Frontmatter["authenticityStatus"]) ?? "pending",
        reviewedBy: r.reviewedBy ?? undefined,
        reviewedAt: r.reviewedAt ?? undefined,
        slug: r.slug,
        body: r.body!,
        readingMinutes: readingMinutes(r.body!),
        source: "db" as const,
        tldr: r.tldr ?? undefined,
        keyFacts: (r.keyFacts as string[] | null) ?? undefined,
        relevantTickers: (r.relevantTickers as string[] | null) ?? undefined,
        diagram: r.diagram ?? undefined,
      }));
  } catch (error) {
    // A missing/unreachable DB must not take down the whole blog — MDX posts still
    // render; this just means DB-native posts are temporarily absent, not a 500.
    console.error("[blog] could not load DB-native posts:", error);
    return [];
  }
}

export const includeDrafts = process.env.NODE_ENV !== "production";

export function isPublished(post: BlogPost): boolean {
  return !post.draft && post.authenticityStatus === "verified";
}

/**
 * THE single visibility check for any route that resolves a post/slug directly
 * (blog/[slug], /archive/[date]) — includeDrafts-aware so local dev preview of an
 * in-progress post keeps working. Do not derive a second, independent visibility
 * check from another table (e.g. digests.status) for a new route: this codebase
 * already hit that exact bug once (two non-atomically-written facts that can
 * disagree) and fixed it by having every caller share this one function instead.
 */
export function isVisible(post: BlogPost): boolean {
  return includeDrafts || isPublished(post);
}

export async function getAllPosts(): Promise<BlogPost[]> {
  const [mdx, db] = await Promise.all([getAllMdxPosts(), getAllDbPosts()]);
  return [...mdx, ...db].filter(isVisible).sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** Public-only view, even in development and tests. */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const [mdx, db] = await Promise.all([getAllMdxPosts(), getAllDbPosts()]);
  return [...mdx, ...db].filter(isPublished).sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Unlike getAllPosts()/getPublishedPosts(), this does NOT filter on draft/
 * authenticityStatus — callers that resolve a single slug into a public-facing
 * page (metadata, JSON-LD, rendered content) MUST check isVisible() themselves
 * before treating the result as publishable. See app/blog/[slug]/page.tsx and
 * app/archive/[date]/page.tsx.
 */
export async function getPost(slug: string): Promise<BlogPost | null> {
  const mdxMatch = listMdxFiles().find((f) => f.replace(/\.mdx$/, "") === slug);
  if (mdxMatch) return loadMdx(mdxMatch);

  const db = await getAllDbPosts();
  return db.find((post) => post.slug === slug) ?? null;
}

export async function getPostsByPillar(pillar: string): Promise<BlogPost[]> {
  const all = await getAllPosts();
  return all.filter((post) => post.pillar === pillar);
}

export async function getAdjacentPosts(slug: string) {
  const all = await getAllPosts();
  const index = all.findIndex((p) => p.slug === slug);
  return {
    newer: index > 0 ? all[index - 1] : null,
    older: index >= 0 && index < all.length - 1 ? all[index + 1] : null,
  };
}
