import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import matter from "gray-matter";
import { cache } from "react";
import { z } from "zod";

import { posts as postsTable, type DiagramSpec } from "@/db/schema";
import { getDb, shouldFailOnDatabaseError } from "@/lib/db";
import {
  assertNoFabricatedExperience,
  findFabricatedExperienceClaims,
  parseFrontmatter,
  type Frontmatter,
} from "@/lib/content/frontmatter";
import { isHttpUrl } from "@/lib/editorial-safety";

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

const listMdxFiles = cache(function listMdxFiles(): string[] {
  try {
    return readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".mdx"));
  } catch {
    return [];
  }
});

function loadMdx(file: string): BlogPost {
  const slug = file.replace(/\.mdx$/, "");
  const raw = readFileSync(join(CONTENT_DIR, file), "utf8");
  const { data, content } = matter(raw);
  const parsed = parseFrontmatter(data, `content/blog/${file}`);
  const source = `content/blog/${file}`;

  // Body-aware half of the provenance contract: the schema checks who *signed* a
  // post, this checks that a machine draft isn't claiming work nobody did.
  //
  // Severity is deliberately split. A fabricated claim sitting in a draft is a
  // problem to fix, not a reason to take the whole site down — three such drafts
  // exist today and hard-failing on them would break every build until someone
  // rewrites them. But the moment one is marked for publication it becomes the
  // exact failure this apparatus exists to prevent, so that path throws.
  if (parsed.draft) {
    const claims = findFabricatedExperienceClaims(parsed, content);
    if (claims.length > 0) {
      console.warn(
        `[blog] ${source} (draft) is origin: ai_generated and claims first-hand work — ` +
          `${claims.join("; ")}. This cannot be published until it is rewritten or reauthored.`,
      );
    }
  } else {
    assertNoFabricatedExperience(parsed, content, source);
  }

  return { ...parsed, slug, body: content, readingMinutes: readingMinutes(content), source: "mdx" };
}

const getAllMdxPosts = cache(function getAllMdxPosts(): BlogPost[] {
  return listMdxFiles().map(loadMdx);
});

type DbPostRow = typeof postsTable.$inferSelect;

const dbPostMetadataSelection = {
  slug: postsTable.slug,
  title: postsTable.title,
  dek: postsTable.dek,
  pillar: postsTable.pillar,
  canonical: postsTable.canonical,
  publishedAt: postsTable.publishedAt,
  draft: postsTable.draft,
  format: postsTable.format,
  origin: postsTable.origin,
  sourceStatus: postsTable.sourceStatus,
  testedStatus: postsTable.testedStatus,
  authenticityStatus: postsTable.authenticityStatus,
  tags: postsTable.tags,
  reviewedBy: postsTable.reviewedBy,
  reviewedAt: postsTable.reviewedAt,
  createdAt: postsTable.createdAt,
} as const;

const dbPostContentSelection = {
  ...dbPostMetadataSelection,
  body: postsTable.body,
  tldr: postsTable.tldr,
  keyFacts: postsTable.keyFacts,
  relevantTickers: postsTable.relevantTickers,
  diagram: postsTable.diagram,
} as const;

type DbPostMetadataRow = Pick<DbPostRow, keyof typeof dbPostMetadataSelection>;
type DbPostContentRow = Pick<DbPostRow, keyof typeof dbPostContentSelection>;

const dbPostContentSchema = z
  .object({
    body: z.string().min(1),
    tldr: z.string().min(1).nullable(),
    keyFacts: z.array(z.string().min(1)).max(5).nullable(),
    relevantTickers: z.array(z.string().min(1)).max(6).nullable(),
    diagram: z
      .object({
        type: z.enum(["sequence", "comparison"]),
        title: z.string().min(1),
        steps: z
          .array(
            z
              .object({ label: z.string().min(1), detail: z.string().min(1) })
              .strict(),
          )
          .min(2)
          .max(6),
      })
      .strict()
      .nullable(),
  })
  .strict();

const dbPostSlugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be a lowercase URL-safe segment");

type BlogPostNavigation = Pick<
  BlogPost,
  | "slug"
  | "title"
  | "date"
  | "draft"
  | "origin"
  | "authenticityStatus"
  | "reviewedBy"
  | "reviewedAt"
>;

function describeDbPost(row: Pick<DbPostMetadataRow, "slug">): string {
  return `posts/${typeof row.slug === "string" && row.slug ? row.slug : "(unknown slug)"}`;
}

function rejectMalformedDbPost(
  row: Pick<DbPostMetadataRow, "slug">,
  error: unknown,
): null {
  console.warn(
    `[blog] ignored malformed DB-native post ${describeDbPost(row)}:`,
    error instanceof Error ? error.message : String(error),
  );
  return null;
}

function parseDbPostMetadata(
  row: DbPostMetadataRow,
): { slug: string; frontmatter: Frontmatter } | null {
  try {
    const slug = dbPostSlugSchema.parse(row.slug);
    const frontmatter = parseFrontmatter(
      {
        title: row.title,
        dek: row.dek,
        pillar: row.pillar,
        date: row.publishedAt ?? row.createdAt,
        canonical: row.canonical ?? undefined,
        tags: row.tags,
        draft: row.draft,
        format: row.format,
        origin: row.origin,
        sourceStatus: row.sourceStatus,
        testedStatus: row.testedStatus,
        authenticityStatus: row.authenticityStatus,
        reviewedBy: row.reviewedBy ?? undefined,
        reviewedAt: row.reviewedAt ?? undefined,
      },
      describeDbPost(row),
    );
    if (frontmatter.canonical && !isHttpUrl(frontmatter.canonical)) {
      throw new Error("canonical URL must use http:// or https://");
    }
    if (
      frontmatter.authenticityStatus === "verified" &&
      (!frontmatter.reviewedBy?.trim() ||
        !(frontmatter.reviewedAt instanceof Date) ||
        Number.isNaN(frontmatter.reviewedAt.getTime()))
    ) {
      throw new Error("verified content requires a valid human review signature");
    }
    return { slug, frontmatter };
  } catch (error) {
    return rejectMalformedDbPost(row, error);
  }
}

function mapDbPostNavigation(row: DbPostMetadataRow): BlogPostNavigation | null {
  const parsed = parseDbPostMetadata(row);
  if (!parsed) return null;
  return {
    slug: parsed.slug,
    title: parsed.frontmatter.title,
    date: parsed.frontmatter.date,
    draft: parsed.frontmatter.draft,
    origin: parsed.frontmatter.origin,
    authenticityStatus: parsed.frontmatter.authenticityStatus,
    reviewedBy: parsed.frontmatter.reviewedBy,
    reviewedAt: parsed.frontmatter.reviewedAt,
  };
}

function mapDbPost(row: DbPostContentRow): BlogPost | null {
  const parsed = parseDbPostMetadata(row);
  if (!parsed) return null;

  const content = dbPostContentSchema.safeParse({
    body: row.body,
    tldr: row.tldr,
    keyFacts: row.keyFacts,
    relevantTickers: row.relevantTickers,
    diagram: row.diagram,
  });
  if (!content.success) return rejectMalformedDbPost(row, content.error);

  try {
    if (parsed.frontmatter.draft) {
      const claims = findFabricatedExperienceClaims(parsed.frontmatter, content.data.body);
      if (claims.length > 0) {
        console.warn(
          `[blog] ${describeDbPost(row)} (draft) is origin: ai_generated and claims ` +
            `first-hand work — ${claims.join("; ")}. This cannot be published until it is ` +
            `rewritten or reauthored.`,
        );
      }
    } else {
      assertNoFabricatedExperience(
        parsed.frontmatter,
        content.data.body,
        `${describeDbPost(row)} (DB-native)`,
      );
    }
  } catch (error) {
    return rejectMalformedDbPost(row, error);
  }

  return {
    ...parsed.frontmatter,
    slug: parsed.slug,
    body: content.data.body,
    readingMinutes: readingMinutes(content.data.body),
    source: "db",
    tldr: content.data.tldr ?? undefined,
    keyFacts: content.data.keyFacts ?? undefined,
    relevantTickers: content.data.relevantTickers ?? undefined,
    diagram: content.data.diagram ?? undefined,
  };
}

/**
 * DB-native posts only — rows where `body` is actually set (a mirror row for an MDX
 * post, written by lib/content/sync.ts, has `body: null` and must not double-render
 * as a second copy of the same post). Exported so callers that need to look up many
 * posts by slug (e.g. lib/content/archive.ts) can fetch once and build a map, rather
 * than calling getPost() per row and re-querying the whole table each time.
 */
async function loadAllDbPosts(): Promise<BlogPost[]> {
  try {
    const rows = await getDb()
      .select(dbPostContentSelection)
      .from(postsTable)
      .where(isNotNull(postsTable.body))
      .orderBy(desc(postsTable.publishedAt));
    return rows.flatMap((row) => {
      const post = mapDbPost(row);
      return post ? [post] : [];
    });
  } catch (error) {
    // Local authoring remains usable without Postgres, but a production Vercel
    // build with DATABASE_URL configured must never silently freeze the DB-backed
    // publication as an apparently legitimate empty site.
    console.error("[blog] could not load DB-native posts:", error);
    if (shouldFailOnDatabaseError()) throw error;
    return [];
  }
}

/** One full DB read at most per React server request, shared by every list consumer. */
export const getAllDbPosts = cache(loadAllDbPosts);

async function loadAllDbPostNavigation(): Promise<BlogPostNavigation[]> {
  try {
    const rows = await getDb()
      .select(dbPostMetadataSelection)
      .from(postsTable)
      .where(isNotNull(postsTable.body))
      .orderBy(desc(postsTable.publishedAt));
    return rows.flatMap((row) => {
      const post = mapDbPostNavigation(row);
      return post ? [post] : [];
    });
  } catch (error) {
    console.error("[blog] could not load DB-native post navigation:", error);
    if (shouldFailOnDatabaseError()) throw error;
    return [];
  }
}

/** Navigation never needs article bodies; keep its DB scan a narrow metadata projection. */
const getAllDbPostNavigation = cache(loadAllDbPostNavigation);

const getDbPostBySlug = cache(async function getDbPostBySlug(
  slug: string,
): Promise<BlogPost | null> {
  try {
    const [row] = await getDb()
      .select(dbPostContentSelection)
      .from(postsTable)
      .where(and(eq(postsTable.slug, slug), isNotNull(postsTable.body)))
      .limit(1);
    return row ? mapDbPost(row) : null;
  } catch (error) {
    console.error(`[blog] could not load DB-native post ${slug}:`, error);
    if (shouldFailOnDatabaseError()) throw error;
    return null;
  }
});

export const includeDrafts = process.env.NODE_ENV !== "production";

type PublicationMetadata = Pick<
  Frontmatter,
  "draft" | "origin" | "authenticityStatus" | "reviewedBy" | "reviewedAt"
>;

function hasKnownOrigin(origin: unknown): origin is Frontmatter["origin"] {
  return origin === "human" || origin === "ai_assisted" || origin === "ai_generated";
}

export function isPublished(post: PublicationMetadata): boolean {
  return (
    post.draft === false &&
    post.authenticityStatus === "verified" &&
    hasKnownOrigin(post.origin) &&
    typeof post.reviewedBy === "string" &&
    post.reviewedBy.trim().length > 0 &&
    post.reviewedAt instanceof Date &&
    !Number.isNaN(post.reviewedAt.getTime())
  );
}

/**
 * THE single visibility check for any route that resolves a post/slug directly
 * (blog/[slug], /archive/[date]) — includeDrafts-aware so local dev preview of an
 * in-progress post keeps working. Do not derive a second, independent visibility
 * check from another table (e.g. digests.status) for a new route: this codebase
 * already hit that exact bug once (two non-atomically-written facts that can
 * disagree) and fixed it by having every caller share this one function instead.
 */
export function isVisible(post: PublicationMetadata): boolean {
  return includeDrafts || isPublished(post);
}

export const getAllPosts = cache(async function getAllPosts(): Promise<BlogPost[]> {
  const [mdx, db] = await Promise.all([getAllMdxPosts(), getAllDbPosts()]);
  return [...mdx, ...db].filter(isVisible).sort((a, b) => b.date.getTime() - a.date.getTime());
});

/** Public-only view, even in development and tests. */
export const getPublishedPosts = cache(async function getPublishedPosts(): Promise<BlogPost[]> {
  const [mdx, db] = await Promise.all([getAllMdxPosts(), getAllDbPosts()]);
  return [...mdx, ...db].filter(isPublished).sort((a, b) => b.date.getTime() - a.date.getTime());
});

/**
 * Personal writing and machine-produced Daily briefs are different reader
 * promises. A reviewed AI-generated brief can be public, but it must not appear
 * under copy that says "what I learned". Daily owns that content; Writing keeps
 * human and disclosed AI-assisted authorship only.
 */
export function isWritingPost(post: { origin: unknown }): boolean {
  return post.origin === "human" || post.origin === "ai_assisted";
}

export const getPublishedWritingPosts = cache(async function getPublishedWritingPosts(): Promise<
  BlogPost[]
> {
  return (await getPublishedPosts()).filter(isWritingPost);
});

/**
 * Unlike getAllPosts()/getPublishedPosts(), this does NOT filter on draft/
 * authenticityStatus — callers that resolve a single slug into a public-facing
 * page (metadata, JSON-LD, rendered content) MUST check isVisible() themselves
 * before treating the result as publishable. See app/blog/[slug]/page.tsx and
 * app/archive/[date]/page.tsx.
 */
export const getPost = cache(async function getPost(slug: string): Promise<BlogPost | null> {
  const mdxMatch = listMdxFiles().find((f) => f.replace(/\.mdx$/, "") === slug);
  if (mdxMatch) return loadMdx(mdxMatch);

  return getDbPostBySlug(slug);
});

export async function getPostsByPillar(pillar: string): Promise<BlogPost[]> {
  const all = await getAllPosts();
  return all.filter((post) => post.pillar === pillar);
}

export const getAdjacentPosts = cache(async function getAdjacentPosts(slug: string) {
  const [mdx, db] = await Promise.all([getAllMdxPosts(), getAllDbPostNavigation()]);
  const visible: BlogPostNavigation[] = [...mdx, ...db]
    .filter(isVisible)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const current = visible.find((post) => post.slug === slug);
  // /blog is the personal Writing surface. Legacy machine-produced Daily posts may
  // retain old permalinks, but must not leak into Writing's previous/next sequence.
  if (!current || !isWritingPost(current)) return { newer: null, older: null };

  const all = visible.filter(isWritingPost);
  const index = all.findIndex((p) => p.slug === slug);
  return {
    newer: index > 0 ? all[index - 1] : null,
    older: index >= 0 && index < all.length - 1 ? all[index + 1] : null,
  };
});
