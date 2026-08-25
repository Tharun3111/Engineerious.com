import { and, eq, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { digests, posts, researchRuns } from "@/db/schema";
import { assertNoFabricatedExperience } from "@/lib/content/frontmatter";
import {
  collectDailySourceUrls,
  dailyBriefDraftSchema,
  factualContentHash,
  myTakeContentHash,
  parseDailyBriefDraft,
  publishedDailyBriefSchema,
  type DailyBriefDraft,
} from "@/lib/daily-brief";
import {
  buildDailyPublishStatement,
  resolveDailyPublishTerminal,
} from "@/lib/daily-publish";
import { getDb } from "@/lib/db";
import { buildDigestPublishStatement } from "@/lib/digest-publish";
import {
  assertUrlsAllowed,
  deriveSourceStatus,
  extractQueryRows,
  isDigestPublishable,
} from "@/lib/editorial-safety";
import { env } from "@/lib/env";
import { submitUrls } from "@/lib/indexnow";
import { FEED_CACHE_TAG } from "@/lib/queries";
import { parseStoredFindings, type Finding } from "@/lib/research";
import { reviewBlockingIssues, reviewDailyBrief } from "@/lib/review";
import { AUTHOR_NAME } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 290;

const idSchema = z.number().int().positive();
const versionSchema = z.number().int().nonnegative();
const bodySchema = z.discriminatedUnion("action", [
  z
    .object({
      id: idSchema,
      action: z.literal("save"),
      expectedVersion: versionSchema,
      draft: dailyBriefDraftSchema,
    })
    .strict(),
  z.object({ id: idSchema, action: z.literal("review"), expectedVersion: versionSchema }).strict(),
  z
    .object({ id: idSchema, action: z.literal("confirm_take"), expectedVersion: versionSchema })
    .strict(),
  z.object({ id: idSchema, action: z.literal("publish"), expectedVersion: versionSchema }).strict(),
  z
    .object({ id: idSchema, action: z.literal("reject"), expectedVersion: versionSchema.optional() })
    .strict(),
  // Recovery only: pre-Phase-2 DB-native blog drafts still use this action.
  z.object({ id: idSchema, action: z.literal("approve") }).strict(),
]);

/** Single-operator site: ADMIN_PASSWORD identifies the human reviewer. */
const REVIEWER_NAME = AUTHOR_NAME;

function conflict(error: string, currentVersion?: number) {
  return NextResponse.json(
    { error, ...(currentVersion === undefined ? {} : { currentVersion }) },
    { status: 409 },
  );
}

function describeValidation(error: unknown): string {
  return error instanceof Error ? error.message : "The Daily Brief failed validation.";
}

function assertDailyIntegrity(draft: DailyBriefDraft, findings: Finding[], label: string): void {
  assertUrlsAllowed(
    collectDailySourceUrls(draft),
    findings.flatMap((finding) => finding.sourceUrls),
    `${label} sources`,
  );
  const machineFields = { ...draft, myTake: "" };
  assertNoFabricatedExperience(
    { title: draft.title, dek: draft.summary, origin: "ai_generated" },
    JSON.stringify(machineFields),
    label,
  );
}

async function loadFindings(db: ReturnType<typeof getDb>, digestId: number): Promise<Finding[]> {
  const [run] = await db
    .select({ findings: researchRuns.findings })
    .from(researchRuns)
    .where(eq(researchRuns.digestId, digestId))
    .limit(1);
  if (!run) throw new Error("No research evidence is stored for this digest.");
  return parseStoredFindings(run.findings);
}

function revalidateDaily(date: string): void {
  revalidatePath("/");
  revalidatePath("/daily");
  revalidatePath(`/daily/${date}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/rss.xml");
}

async function finishDailyPublication(date: string): Promise<void> {
  revalidateDaily(date);
  const site = env.siteUrl.replace(/\/$/, "");
  await submitUrls([`${site}/daily/${date}`, `${site}/daily`, `${site}/`]);
}

async function rejectDigest(
  db: ReturnType<typeof getDb>,
  digest: typeof digests.$inferSelect,
  expectedVersion?: number,
) {
  if (digest.status === "rejected") {
    return NextResponse.json({ ok: true, status: "rejected", idempotent: true });
  }
  if (expectedVersion !== undefined && digest.draftVersion !== expectedVersion) {
    return conflict(
      `This draft changed in another session (current revision ${digest.draftVersion}). Reload before rejecting.`,
      digest.draftVersion,
    );
  }

  const conditions = [eq(digests.id, digest.id), eq(digests.status, "pending_review")];
  if (expectedVersion !== undefined) conditions.push(eq(digests.draftVersion, expectedVersion));
  const [claimed] = await db
    .update(digests)
    .set({ status: "rejected", error: "rejected by human review", updatedAt: new Date() })
    .where(and(...conditions))
    .returning({ id: digests.id });

  if (claimed) return NextResponse.json({ ok: true, status: "rejected" });

  const [terminal] = await db
    .select({ status: digests.status, draftVersion: digests.draftVersion })
    .from(digests)
    .where(eq(digests.id, digest.id))
    .limit(1);
  if (terminal?.status === "rejected") {
    return NextResponse.json({ ok: true, status: "rejected", idempotent: true });
  }
  return conflict(
    terminal?.draftVersion !== expectedVersion
      ? `This draft changed in another session (current revision ${terminal?.draftVersion ?? "unknown"}). Reload before rejecting.`
      : "Digest is not pending review (already actioned?).",
    terminal?.draftVersion,
  );
}

async function saveDailyDraft(
  db: ReturnType<typeof getDb>,
  digest: typeof digests.$inferSelect,
  expectedVersion: number,
  submittedDraft: DailyBriefDraft,
) {
  if (digest.status !== "pending_review") {
    return conflict("Only a pending-review Daily Brief can be edited.", digest.draftVersion);
  }
  if (digest.draftVersion !== expectedVersion) {
    return conflict(
      `This draft changed in another session (current revision ${digest.draftVersion}). Reload before saving.`,
      digest.draftVersion,
    );
  }
  if (!digest.dailyDraft) return conflict("This digest has no structured Daily draft.");

  let current: DailyBriefDraft;
  let next: DailyBriefDraft;
  try {
    current = parseDailyBriefDraft(digest.dailyDraft);
    next = parseDailyBriefDraft(submittedDraft);
    if (next.date !== digest.date) {
      throw new Error(`Daily Brief date ${next.date} does not match digest date ${digest.date}.`);
    }
    const findings = await loadFindings(db, digest.id);
    assertDailyIntegrity(next, findings, `Daily Brief draft ${digest.date}`);
  } catch (error) {
    return NextResponse.json({ error: describeValidation(error) }, { status: 400 });
  }

  const factualChanged = factualContentHash(current) !== factualContentHash(next);
  const takeChanged = current.myTake !== next.myTake;
  if (!factualChanged && !takeChanged) {
    return NextResponse.json({
      ok: true,
      status: digest.status,
      draftVersion: digest.draftVersion,
      draft: next,
      reviewCurrent: digest.reviewedContentHash === factualContentHash(next),
      myTakeConfirmed:
        Boolean(digest.myTakeConfirmedAt && digest.myTakeConfirmedBy) &&
        digest.myTakeConfirmedHash === myTakeContentHash(next.myTake),
      idempotent: true,
    });
  }

  const [saved] = await db
    .update(digests)
    .set({
      dailyDraft: next,
      draftVersion: sql`${digests.draftVersion} + 1`,
      ...(factualChanged
        ? {
            reviewReport: null,
            reviewedContentHash: null,
            reviewedBy: null,
            reviewedAt: null,
          }
        : {}),
      myTakeConfirmedHash: null,
      myTakeConfirmedAt: null,
      myTakeConfirmedBy: null,
      error: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(digests.id, digest.id),
        eq(digests.status, "pending_review"),
        eq(digests.draftVersion, expectedVersion),
      ),
    )
    .returning({ draftVersion: digests.draftVersion });

  if (!saved) {
    const [currentRow] = await db
      .select({ draftVersion: digests.draftVersion })
      .from(digests)
      .where(eq(digests.id, digest.id))
      .limit(1);
    return conflict(
      `This draft changed in another session (current revision ${currentRow?.draftVersion ?? "unknown"}). Reload before saving.`,
      currentRow?.draftVersion,
    );
  }

  return NextResponse.json({
    ok: true,
    status: "pending_review",
    draftVersion: saved.draftVersion,
    draft: next,
    reviewReport: factualChanged ? null : digest.reviewReport,
    reviewCurrent:
      !factualChanged && digest.reviewedContentHash === factualContentHash(next),
    myTakeConfirmed: false,
    factualReviewInvalidated: factualChanged,
    myTakeConfirmationInvalidated: true,
  });
}

async function reviewDailyDraft(
  db: ReturnType<typeof getDb>,
  digest: typeof digests.$inferSelect,
  expectedVersion: number,
) {
  if (digest.status !== "pending_review") {
    return conflict("Only a pending-review Daily Brief can be reviewed.", digest.draftVersion);
  }
  if (digest.draftVersion !== expectedVersion) {
    return conflict(
      `This draft changed in another session (current revision ${digest.draftVersion}). Reload before reviewing.`,
      digest.draftVersion,
    );
  }

  let draft: DailyBriefDraft;
  let findings: Finding[];
  try {
    draft = parseDailyBriefDraft(digest.dailyDraft);
    findings = await loadFindings(db, digest.id);
    assertDailyIntegrity(draft, findings, `Daily Brief review ${digest.date}`);
  } catch (error) {
    return NextResponse.json({ error: describeValidation(error) }, { status: 409 });
  }

  const contentHash = factualContentHash(draft);
  if (
    digest.reviewedContentHash === contentHash &&
    reviewBlockingIssues(digest.reviewReport).length === 0
  ) {
    return NextResponse.json({
      ok: true,
      status: digest.status,
      draftVersion: digest.draftVersion,
      reviewReport: digest.reviewReport,
      reviewCurrent: true,
      myTakeConfirmed:
        Boolean(digest.myTakeConfirmedAt && digest.myTakeConfirmedBy) &&
        digest.myTakeConfirmedHash === myTakeContentHash(draft.myTake),
      idempotent: true,
    });
  }

  let report;
  try {
    report = await reviewDailyBrief({ draft, findings });
  } catch (error) {
    return NextResponse.json({ error: describeValidation(error) }, { status: 502 });
  }
  const blockers = reviewBlockingIssues(report);
  const clean = blockers.length === 0;
  const now = new Date();
  const [stored] = await db
    .update(digests)
    .set({
      reviewReport: report,
      reviewedContentHash: clean ? contentHash : null,
      // This checkpoint is an automated adversarial review initiated by the
      // editor. The human reviewer is recorded only by the atomic publish action.
      reviewedBy: null,
      reviewedAt: now,
      error: clean ? null : "editorial review blockers remain",
      updatedAt: now,
    })
    .where(
      and(
        eq(digests.id, digest.id),
        eq(digests.status, "pending_review"),
        eq(digests.draftVersion, expectedVersion),
      ),
    )
    .returning({ id: digests.id });

  if (!stored) {
    const [currentRow] = await db
      .select({ draftVersion: digests.draftVersion })
      .from(digests)
      .where(eq(digests.id, digest.id))
      .limit(1);
    return conflict(
      `This draft changed in another session (current revision ${currentRow?.draftVersion ?? "unknown"}). The review was not attached.`,
      currentRow?.draftVersion,
    );
  }

  return NextResponse.json({
    ok: true,
    status: "pending_review",
    draftVersion: expectedVersion,
    reviewReport: report,
    reviewCurrent: clean,
    myTakeConfirmed:
      Boolean(digest.myTakeConfirmedAt && digest.myTakeConfirmedBy) &&
      digest.myTakeConfirmedHash === myTakeContentHash(draft.myTake),
    blockers,
  });
}

async function confirmMyTake(
  db: ReturnType<typeof getDb>,
  digest: typeof digests.$inferSelect,
  expectedVersion: number,
) {
  if (digest.status !== "pending_review") {
    return conflict("Only a pending-review Daily Brief can have My Take confirmed.", digest.draftVersion);
  }
  if (digest.draftVersion !== expectedVersion) {
    return conflict(
      `This draft changed in another session (current revision ${digest.draftVersion}). Reload before confirming My Take.`,
      digest.draftVersion,
    );
  }
  const parsed = publishedDailyBriefSchema.safeParse(digest.dailyDraft);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "My Take must contain human-written text before it can be confirmed.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const takeHash = myTakeContentHash(parsed.data.myTake);
  if (
    digest.myTakeConfirmedHash === takeHash &&
    digest.myTakeConfirmedAt &&
    digest.myTakeConfirmedBy
  ) {
    return NextResponse.json({
      ok: true,
      status: digest.status,
      draftVersion: digest.draftVersion,
      reviewCurrent: digest.reviewedContentHash === factualContentHash(parsed.data),
      myTakeConfirmed: true,
      idempotent: true,
    });
  }

  const now = new Date();
  const [stored] = await db
    .update(digests)
    .set({
      myTakeConfirmedHash: takeHash,
      myTakeConfirmedAt: now,
      myTakeConfirmedBy: REVIEWER_NAME,
      updatedAt: now,
    })
    .where(
      and(
        eq(digests.id, digest.id),
        eq(digests.status, "pending_review"),
        eq(digests.draftVersion, expectedVersion),
      ),
    )
    .returning({ id: digests.id });

  if (!stored) {
    const [currentRow] = await db
      .select({ draftVersion: digests.draftVersion })
      .from(digests)
      .where(eq(digests.id, digest.id))
      .limit(1);
    return conflict(
      `This draft changed in another session (current revision ${currentRow?.draftVersion ?? "unknown"}). Reload before confirming My Take.`,
      currentRow?.draftVersion,
    );
  }

  return NextResponse.json({
    ok: true,
    status: "pending_review",
    draftVersion: expectedVersion,
    reviewCurrent: digest.reviewedContentHash === factualContentHash(parsed.data),
    myTakeConfirmed: true,
  });
}

async function publishDailyDraft(
  db: ReturnType<typeof getDb>,
  digest: typeof digests.$inferSelect,
  expectedVersion: number,
) {
  let draft: DailyBriefDraft;
  try {
    draft = publishedDailyBriefSchema.parse(digest.dailyDraft);
    if (draft.date !== digest.date) {
      throw new Error(`Daily Brief date ${draft.date} does not match digest date ${digest.date}.`);
    }
    const findings = await loadFindings(db, digest.id);
    // Re-run deterministic gates here even if SAVE and REVIEW already passed. A
    // publish click is the last integrity boundary after every possible admin edit.
    assertDailyIntegrity(draft, findings, `Daily Brief publication ${digest.date}`);
  } catch (error) {
    return NextResponse.json({ error: describeValidation(error) }, { status: 409 });
  }

  const blockers = reviewBlockingIssues(digest.reviewReport);
  if (blockers.length > 0) {
    return NextResponse.json(
      { error: "Resolve the editorial review flags before publishing.", blockers },
      { status: 409 },
    );
  }

  const expectedContentHash = factualContentHash(draft);
  const expectedMyTakeHash = myTakeContentHash(draft.myTake);
  if (digest.draftVersion !== expectedVersion) {
    return conflict(
      `This draft changed in another session (current revision ${digest.draftVersion}). Reload before publishing.`,
      digest.draftVersion,
    );
  }
  if (digest.reviewedContentHash !== expectedContentHash) {
    return conflict("The current factual revision has not passed review.", digest.draftVersion);
  }
  if (
    digest.myTakeConfirmedHash !== expectedMyTakeHash ||
    !digest.myTakeConfirmedAt ||
    !digest.myTakeConfirmedBy
  ) {
    return conflict("The current My Take text has not been explicitly confirmed.", digest.draftVersion);
  }

  const now = new Date();
  const result = await db.execute(
    buildDailyPublishStatement({
      id: digest.id,
      expectedVersion,
      expectedContentHash,
      expectedMyTakeHash,
      reviewerName: REVIEWER_NAME,
      now,
    }),
  );
  const [published] = extractQueryRows(result);

  if (!published) {
    const [terminal] = await db
      .select({
        status: digests.status,
        draftVersion: digests.draftVersion,
        dailyPublished: digests.dailyPublished,
        reviewedContentHash: digests.reviewedContentHash,
        myTakeConfirmedHash: digests.myTakeConfirmedHash,
      })
      .from(digests)
      .where(eq(digests.id, digest.id))
      .limit(1);
    if (!terminal) return NextResponse.json({ error: "Digest no longer exists." }, { status: 404 });

    const resolution = resolveDailyPublishTerminal(terminal, {
      expectedVersion,
      expectedContentHash,
      expectedMyTakeHash,
    });
    if (resolution.outcome === "idempotent") {
      // A prior request may have committed the atomic snapshot and then died before
      // cache invalidation. These downstream operations are safe to repeat.
      await finishDailyPublication(digest.date);
      return NextResponse.json({
        ok: true,
        status: "published",
        date: digest.date,
        draftVersion: expectedVersion,
        idempotent: true,
        emailSent: false,
      });
    }
    if (resolution.outcome === "rejected") {
      return conflict("This Daily Brief was rejected while publication was waiting.", terminal.draftVersion);
    }
    return conflict(
      resolution.reason === "stale_version"
        ? `This draft changed in another session (current revision ${terminal.draftVersion}). Reload before publishing.`
        : `Daily publication lost its integrity check: ${resolution.reason.replaceAll("_", " ")}.`,
      terminal.draftVersion,
    );
  }

  await finishDailyPublication(digest.date);

  return NextResponse.json({
    ok: true,
    status: "published",
    date: digest.date,
    draftVersion: expectedVersion,
    emailSent: false,
  });
}

/** Recover and publish a pre-Phase-2 DB-native blog draft. */
async function publishLegacyDigest(
  db: ReturnType<typeof getDb>,
  digest: typeof digests.$inferSelect,
) {
  if (digest.dailyDraft) {
    return conflict("Structured Daily Briefs must use the publish action after My Take confirmation.");
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
    return conflict("Digest is not pending review (already actioned?).");
  }

  const blockers = reviewBlockingIssues(digest.reviewReport);
  if (blockers.length > 0) {
    return NextResponse.json(
      { error: "Resolve the editorial review flags before publishing.", blockers },
      { status: 409 },
    );
  }
  if (!digest.blogPostSlug) return conflict("Digest has no associated post — cannot approve.");

  const [[postDraft], [researchRun]] = await Promise.all([
    db
      .select({ title: posts.title, dek: posts.dek, origin: posts.origin, body: posts.body })
      .from(posts)
      .where(eq(posts.slug, digest.blogPostSlug))
      .limit(1),
    db
      .select({ findings: researchRuns.findings })
      .from(researchRuns)
      .where(eq(researchRuns.digestId, digest.id))
      .limit(1),
  ]);
  if (!postDraft?.body) return conflict(`Post "${digest.blogPostSlug}" no longer exists or has no body.`);

  let findings: Finding[];
  try {
    findings = parseStoredFindings(researchRun?.findings);
    assertNoFabricatedExperience(
      {
        title: postDraft.title,
        dek: postDraft.dek ?? "",
        origin:
          postDraft.origin === "human" ||
          postDraft.origin === "ai_assisted" ||
          postDraft.origin === "ai_generated"
            ? postDraft.origin
            : "ai_generated",
      },
      postDraft.body,
      `posts/${digest.blogPostSlug} (approval gate)`,
    );
  } catch (error) {
    return NextResponse.json({ error: describeValidation(error) }, { status: 409 });
  }

  const sourceStatus = deriveSourceStatus(findings.flatMap((finding) => finding.sourceUrls));
  const now = new Date();
  const editorialDate = new Date(`${digest.date}T12:00:00Z`);
  const result = await db.execute(
    buildDigestPublishStatement({
      id: digest.id,
      reviewerName: REVIEWER_NAME,
      now,
      editorialDate,
      sourceStatus,
    }),
  );
  const [published] = extractQueryRows<{ slug: string }>(result);

  if (!published) {
    const [terminal] = await db
      .select({
        status: digests.status,
        blogPostSlug: digests.blogPostSlug,
        emailSentAt: digests.emailSentAt,
      })
      .from(digests)
      .where(eq(digests.id, digest.id))
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
    return conflict(`Post "${digest.blogPostSlug}" no longer exists or the digest was already actioned.`);
  }

  revalidateTag(FEED_CACHE_TAG, "max");
  for (const path of [
    "/blog",
    `/blog/${digest.blogPostSlug}`,
    "/sitemap.xml",
    "/rss.xml",
    "/",
    "/archive",
    `/archive/${digest.date}`,
  ]) {
    revalidatePath(path);
  }
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

/** Human-only Daily lifecycle. No action in this route sends email. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid digest action.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const db = getDb();
  const [digest] = await db.select().from(digests).where(eq(digests.id, input.id)).limit(1);
  if (!digest) return NextResponse.json({ error: "Digest not found." }, { status: 404 });

  switch (input.action) {
    case "save":
      return saveDailyDraft(db, digest, input.expectedVersion, input.draft);
    case "review":
      return reviewDailyDraft(db, digest, input.expectedVersion);
    case "confirm_take":
      return confirmMyTake(db, digest, input.expectedVersion);
    case "publish":
      return publishDailyDraft(db, digest, input.expectedVersion);
    case "reject":
      return rejectDigest(db, digest, input.expectedVersion);
    case "approve":
      return publishLegacyDigest(db, digest);
  }
}
