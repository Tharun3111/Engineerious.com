import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { digests, posts, researchRuns } from "@/db/schema";
import { assertNoFabricatedExperience } from "@/lib/content/frontmatter";
import { getDb } from "@/lib/db";
import { buildDigestPublishStatement } from "@/lib/digest-publish";
import {
  deriveSourceStatus,
  extractQueryRows,
  isDigestPublishable,
} from "@/lib/editorial-safety";
import { env } from "@/lib/env";
import { submitUrls } from "@/lib/indexnow";
import { FEED_CACHE_TAG } from "@/lib/queries";
import { parseStoredFindings, type Finding } from "@/lib/research";
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
    if (digest.status === "rejected") {
      return NextResponse.json({ ok: true, status: "rejected", idempotent: true });
    }

    const [claimed] = await db
      .update(digests)
      .set({ status: "rejected", error: "rejected by human review", updatedAt: new Date() })
      .where(and(eq(digests.id, id), eq(digests.status, "pending_review")))
      .returning({ id: digests.id });
    if (!claimed) {
      const [terminal] = await db
        .select({ status: digests.status })
        .from(digests)
        .where(eq(digests.id, id))
        .limit(1);
      if (terminal?.status === "rejected") {
        return NextResponse.json({ ok: true, status: "rejected", idempotent: true });
      }
      return NextResponse.json({ error: "Digest is not pending_review (already actioned?)" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  if (digest.status === "published") {
    return NextResponse.json({
      ok: true,
      status: "published",
      slug: digest.blogPostSlug,
      emailSent: Boolean(digest.emailSentAt),
      emailError: null,
      idempotent: true,
    });
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

  const [[postDraft], [researchRun]] = await Promise.all([
    db
      .select({
        title: posts.title,
        dek: posts.dek,
        origin: posts.origin,
        body: posts.body,
      })
      .from(posts)
      .where(eq(posts.slug, digest.blogPostSlug))
      .limit(1),
    db
      .select({ findings: researchRuns.findings })
      .from(researchRuns)
      .where(eq(researchRuns.digestId, digest.id))
      .limit(1),
  ]);

  if (!postDraft?.body) {
    return NextResponse.json(
      { error: `Post "${digest.blogPostSlug}" no longer exists or has no body.` },
      { status: 409 },
    );
  }

  const postOrigin =
    postDraft.origin === "human" ||
    postDraft.origin === "ai_assisted" ||
    postDraft.origin === "ai_generated"
      ? postDraft.origin
      : "ai_generated";

  let findings: Finding[];
  try {
    findings = parseStoredFindings(researchRun?.findings);
    assertNoFabricatedExperience(
      {
        title: postDraft.title,
        dek: postDraft.dek ?? "",
        origin: postOrigin,
      },
      postDraft.body,
      `posts/${digest.blogPostSlug} (approval gate)`,
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The draft failed deterministic editorial validation.",
      },
      { status: 409 },
    );
  }
  const sourceStatus = deriveSourceStatus(findings.flatMap((finding) => finding.sourceUrls));

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
  const result = await db.execute(
    buildDigestPublishStatement({
      id,
      reviewerName: REVIEWER_NAME,
      now,
      editorialDate,
      sourceStatus,
    }),
  );
  const [published] = extractQueryRows<{ slug: string }>(result);

  if (!published) {
    const [terminal] = await db
      .select({ status: digests.status, blogPostSlug: digests.blogPostSlug, emailSentAt: digests.emailSentAt })
      .from(digests)
      .where(eq(digests.id, id))
      .limit(1);
    if (terminal?.status === "published") {
      return NextResponse.json({
        ok: true,
        status: "published",
        slug: terminal.blogPostSlug,
        emailSent: Boolean(terminal.emailSentAt),
        emailError: null,
        idempotent: true,
      });
    }
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
