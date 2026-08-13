import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { digests, posts } from "@/db/schema";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { submitUrls } from "@/lib/indexnow";
import { FEED_CACHE_TAG } from "@/lib/queries";
import { resendConfigured, sendDigest } from "@/lib/resend";
import { AUTHOR_NAME } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// This route now makes two outbound network calls (Resend send, IndexNow submit)
// after the DB writes commit — give it real headroom instead of inheriting the
// platform default (10s Hobby / 15s Pro), the shortest ceiling of any
// network-calling route in this app despite being the highest-stakes one.
export const maxDuration = 60;

const bodySchema = z.object({
  id: z.number().int().positive(),
  action: z.enum(["approve", "reject"]),
});

/** Whoever is behind ADMIN_PASSWORD — this is a single-operator site, not a byline picker. */
const REVIEWER_NAME = AUTHOR_NAME;

/**
 * The one approval action, per the site's design: approving a digest publishes the
 * post AND sends the newsletter in the same request — no separate "now go click
 * send" step. This is the single highest-stakes endpoint in the codebase — the only
 * place a post goes live under a real byline or a real email goes to real
 * subscribers — so it gets the same atomic claim pattern as the cron routes, not a
 * plain select-then-write. A double-click or a retried request must not double-send.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must be { id, action }" }, { status: 400 });
  }

  const { id, action } = parsed.data;
  const db = getDb();

  if (action === "reject") {
    const [claimed] = await db
      .update(digests)
      .set({ status: "failed", error: "rejected by human review", updatedAt: new Date() })
      .where(and(eq(digests.id, id), eq(digests.status, "pending_review")))
      .returning({ id: digests.id });
    if (!claimed) {
      return NextResponse.json({ error: "Digest is not pending_review (already actioned?)" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // Claim FIRST, before any real work — 'approved' is a transient marker here, not
  // a resting state; a concurrent second request sees 0 rows and bails immediately,
  // before it could ever reach sendDigest().
  const [claimed] = await db
    .update(digests)
    .set({ status: "approved", updatedAt: new Date() })
    .where(and(eq(digests.id, id), eq(digests.status, "pending_review")))
    .returning();
  if (!claimed) {
    return NextResponse.json({ error: "Digest is not pending_review (already actioned?)" }, { status: 409 });
  }

  if (!claimed.blogPostSlug) {
    await db
      .update(digests)
      .set({ status: "failed", error: "approved but had no associated post", updatedAt: new Date() })
      .where(eq(digests.id, id));
    return NextResponse.json({ error: "Digest has no associated post — cannot approve" }, { status: 409 });
  }

  const now = new Date();

  const [publishedPost] = await db
    .update(posts)
    .set({
      draft: false,
      authenticityStatus: "verified",
      reviewedBy: REVIEWER_NAME,
      reviewedAt: now,
      // lib/content/blog.ts reads `publishedAt ?? createdAt` as the post's canonical
      // date — everywhere that date is used (byline, JSON-LD, sitemap lastmod, RSS)
      // was silently falling back to the pre-review WRITE-stage insert timestamp
      // without this, understating how old "published" content actually is.
      publishedAt: now,
      updatedAt: now,
    })
    .where(eq(posts.slug, claimed.blogPostSlug))
    .returning({ id: posts.id });

  if (!publishedPost) {
    // The post row is gone (deleted, or never existed despite the slug being set) —
    // do NOT proceed to send an email linking to nothing. Surfaced as failed, not
    // silently marked published.
    await db
      .update(digests)
      .set({ status: "failed", error: `post "${claimed.blogPostSlug}" not found — cannot publish`, updatedAt: now })
      .where(eq(digests.id, id));
    return NextResponse.json({ error: `Post "${claimed.blogPostSlug}" no longer exists` }, { status: 409 });
  }

  let emailSentAt: Date | null = null;
  let emailError: string | null = null;

  if (claimed.emailHtml && resendConfigured()) {
    try {
      await sendDigest({ subject: `Engineerious — ${claimed.date}`, html: claimed.emailHtml });
      emailSentAt = now;
    } catch (error) {
      emailError = error instanceof Error ? error.message : String(error);
      console.error(`[admin/digests] email send failed for digest #${id}:`, emailError);
    }
  } else if (!claimed.emailHtml) {
    emailError = "digest has no rendered email content";
  } else {
    emailError = "Resend is not configured";
  }

  // Publishing succeeded regardless of email outcome — the post is real, reviewed
  // content and stays live. `error` carries the email failure forward so it's
  // visible on the row rather than the digest just vanishing from the pending queue.
  await db
    .update(digests)
    .set({
      status: "published",
      publishedAt: now,
      reviewedBy: REVIEWER_NAME,
      reviewedAt: now,
      emailSentAt,
      error: emailError,
      updatedAt: now,
    })
    .where(eq(digests.id, id));

  revalidateTag(FEED_CACHE_TAG);
  revalidatePath("/blog");
  revalidatePath(`/blog/${claimed.blogPostSlug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/rss.xml");
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath(`/archive/${claimed.date}`);

  // Best-effort — submitUrls() never throws, so this can't turn a successful
  // publish into a failed response.
  const site = env.siteUrl.replace(/\/$/, "");
  await submitUrls([`${site}/blog/${claimed.blogPostSlug}`, `${site}/blog`, `${site}/`]);

  return NextResponse.json({
    ok: true,
    status: "published",
    slug: claimed.blogPostSlug,
    emailSent: Boolean(emailSentAt),
    emailError,
  });
}
