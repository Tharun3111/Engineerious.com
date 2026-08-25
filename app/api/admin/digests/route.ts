import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { digests } from "@/db/schema";
import { getDb } from "@/lib/db";
import { extractQueryRows, isDigestPublishable } from "@/lib/editorial-safety";
import { env } from "@/lib/env";
import { submitUrls } from "@/lib/indexnow";
import { FEED_CACHE_TAG } from "@/lib/queries";
import { reviewBlockingIssues } from "@/lib/review";
import { AUTHOR_NAME } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// IndexNow is best-effort after the atomic web publication statement.
export const maxDuration = 60;

const bodySchema = z.object({
  id: z.number().int().positive(),
  action: z.enum(["approve", "reject"]),
});

/** Whoever is behind ADMIN_PASSWORD — this is a single-operator site, not a byline picker. */
const REVIEWER_NAME = AUTHOR_NAME;

/** Human approval publishes the web artifact only. Newsletter delivery has a
 * separate state machine and manual action so a retry can never double-send. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must be { id, action }" }, { status: 400 });
  }

  const { id, action } = parsed.data;
  const db = getDb();
  const [digest] = await db.select().from(digests).where(eq(digests.id, id)).limit(1);

  if (!digest) {
    return NextResponse.json({ error: "Digest not found." }, { status: 404 });
  }

  if (action === "reject") {
    const [claimed] = await db
      .update(digests)
      .set({ status: "rejected", error: "rejected by human review", updatedAt: new Date() })
      .where(
        and(
          eq(digests.id, id),
          inArray(digests.status, ["pending_review", "approved"]),
        ),
      )
      .returning({ id: digests.id });
    if (!claimed) {
      return NextResponse.json({ error: "Digest is not pending_review (already actioned?)" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  if (!isDigestPublishable(digest.status)) {
    return NextResponse.json({ error: "Digest is not pending_review (already actioned?)" }, { status: 409 });
  }

  const blockers = reviewBlockingIssues(digest.reviewReport);
  if (blockers.length > 0) {
    return NextResponse.json(
      { error: "Resolve the editorial review flags before publishing.", blockers },
      { status: 409 },
    );
  }

  if (!digest.blogPostSlug) {
    return NextResponse.json({ error: "Digest has no associated post — cannot approve" }, { status: 409 });
  }

  const now = new Date();

  // The post's canonical date is the digest's EDITORIAL date, not the moment a human
  // happened to click approve.
  //
  // This was `now`, to avoid falling back to the pre-review WRITE-stage insert
  // timestamp. But `now` collapses a reviewed backlog: approving four pending digests
  // in one sitting stamped all four with the same instant, so /blog rendered four
  // posts dated 2026-08-21 about one incident while /archive — which groups by
  // digests.date — correctly showed them spread across 08-16 to 08-21. The same post
  // carried two different dates depending on the page, RSS emitted four items nine
  // seconds apart with slugs backdated across six days, and sitemap lastmod followed
  // the approval click. It made a roughly-daily cadence look like a content mill.
  //
  // digests.date is Chicago-anchored (uniqueIndex, one row per day) and is what the
  // content is *about*, so it is the honest value. Noon UTC keeps the rendered
  // calendar day stable on both sides of the Chicago offset.
  const editorialDate = new Date(`${digest.date}T12:00:00Z`);

  // One Postgres statement updates both facts. If the request dies, both remain
  // unchanged or both commit; a legacy `approved` row can safely retry this path.
  const result = await db.execute(sql`
    with eligible as (
      select id, blog_post_slug
        from digests
       where id = ${id}
         and status in ('pending_review', 'approved')
         and blog_post_slug is not null
    ), published_post as (
      update posts
         set draft = false,
             authenticity_status = 'verified',
             reviewed_by = ${REVIEWER_NAME},
             reviewed_at = ${now},
             published_at = ${editorialDate},
             updated_at = ${now}
        from eligible
       where posts.slug = eligible.blog_post_slug
      returning posts.slug, eligible.id as digest_id
    )
    update digests
       set status = 'published',
           published_at = ${now},
           reviewed_by = ${REVIEWER_NAME},
           reviewed_at = ${now},
           error = null,
           updated_at = ${now}
      from published_post
     where digests.id = published_post.digest_id
    returning published_post.slug
  `);
  const [published] = extractQueryRows<{ slug: string }>(result);

  if (!published) {
    return NextResponse.json(
      { error: `Post "${digest.blogPostSlug}" no longer exists or the digest was already actioned.` },
      { status: 409 },
    );
  }

  revalidateTag(FEED_CACHE_TAG, "max");
  revalidatePath("/blog");
  revalidatePath(`/blog/${digest.blogPostSlug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/rss.xml");
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath(`/archive/${digest.date}`);

  // Best-effort — submitUrls() never throws, so this can't turn a successful
  // publish into a failed response.
  const site = env.siteUrl.replace(/\/$/, "");
  await submitUrls([`${site}/blog/${digest.blogPostSlug}`, `${site}/blog`, `${site}/`]);

  return NextResponse.json({
    ok: true,
    status: "published",
    slug: digest.blogPostSlug,
    emailSent: false,
    emailError: null,
  });
}
