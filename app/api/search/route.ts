import { NextResponse } from "next/server";

import { getPublishedPosts } from "@/lib/content/blog";
import { getPillar } from "@/lib/pillars";

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * Minimal search index for the ⌘K command palette (components/CommandPalette.tsx).
 * Title, dek and pillar only — enough to filter and label a result, nothing a
 * reader wouldn't already see on the index page. Same cache window as the
 * homepage/blog feed reads.
 */
export async function GET() {
  const posts = await getPublishedPosts();
  const index = posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    dek: post.dek,
    pillar: getPillar(post.pillar)?.name ?? "Unfiled",
  }));
  return NextResponse.json(index, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
