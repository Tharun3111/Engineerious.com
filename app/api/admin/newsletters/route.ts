import { and, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { digests } from "@/db/schema";
import { ADMIN_REALM, authorizeAdmin } from "@/lib/auth";
import {
  factualContentHash,
  myTakeContentHash,
  publishedDailyBriefSchema,
  type PublishedDailyBrief,
} from "@/lib/daily-brief";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { extractQueryRows } from "@/lib/editorial-safety";
import {
  buildNewsletterSendClaimStatement,
  isNewsletterArtifactCurrent,
  newsletterActionSchema,
  newsletterSendClaimSchema,
  prepareNewsletterArtifact,
  providerStatusToNewsletterStatus,
  type NewsletterActionResult,
  type NewsletterSendClaim,
} from "@/lib/newsletter";
import {
  createBroadcastDraft,
  getBroadcast,
  newsletterDeliveryConfigured,
  ResendRequestError,
  sendBroadcast,
  type ResendBroadcastStatus,
} from "@/lib/resend";
import { AUTHOR_NAME } from "@/lib/site";
import { countActiveUnsyncedSubscribers } from "@/lib/subscriber-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type DigestRow = typeof digests.$inferSelect;

class NewsletterConfigurationError extends Error {}

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: { "WWW-Authenticate": ADMIN_REALM } },
  );
}

function validateMutationRequest(request: Request): NextResponse | null {
  const mediaType = (request.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") {
    return NextResponse.json({ error: "Cross-site admin mutations are not allowed." }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return NextResponse.json({ error: "Cross-origin admin mutations are not allowed." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "The request Origin is invalid." }, { status: 403 });
    }
  }
  return null;
}

function conflict(error: string, currentVersion?: number) {
  return NextResponse.json(
    { error, ...(currentVersion === undefined ? {} : { currentVersion }) },
    { status: 409 },
  );
}

function configurationError(error: unknown) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Newsletter delivery is not configured." },
    { status: 503 },
  );
}

function artifactError(error: unknown) {
  if (error instanceof NewsletterConfigurationError) return configurationError(error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "The newsletter artifact failed validation." },
    { status: 409 },
  );
}

function response(input: Omit<NewsletterActionResult, "ok">) {
  return NextResponse.json({ ok: true, ...input });
}

function publishedBrief(digest: DigestRow): PublishedDailyBrief {
  if (digest.status !== "published" || !digest.publishedAt) {
    throw new Error("Only a published Daily Brief can be prepared for the newsletter.");
  }
  const parsed = publishedDailyBriefSchema.parse(digest.dailyPublished);
  if (parsed.date !== digest.date) {
    throw new Error("The published Daily snapshot does not match its digest date.");
  }
  if (
    !digest.reviewedAt ||
    !digest.reviewedBy ||
    !digest.myTakeConfirmedAt ||
    !digest.myTakeConfirmedBy ||
    factualContentHash(parsed) !== digest.reviewedContentHash ||
    myTakeContentHash(parsed.myTake) !== digest.myTakeConfirmedHash
  ) {
    throw new Error("The published Daily snapshot does not match its reviewed, confirmed revision.");
  }
  return parsed;
}

function artifactFor(digest: DigestRow, subject?: string) {
  const postalAddress = env.newsletterPostalAddress?.trim();
  if (!postalAddress) {
    throw new NewsletterConfigurationError("NEWSLETTER_POSTAL_ADDRESS is not configured");
  }
  return prepareNewsletterArtifact({
    brief: publishedBrief(digest),
    siteUrl: env.siteUrl,
    postalAddress,
    subject,
  });
}

function currentArtifactIsApproved(digest: DigestRow): boolean {
  const postalAddress = env.newsletterPostalAddress?.trim();
  if (!postalAddress) return false;
  try {
    return isNewsletterArtifactCurrent({
      brief: publishedBrief(digest),
      siteUrl: env.siteUrl,
      postalAddress,
      subject: digest.newsletterSubject,
      html: digest.emailHtml,
      approvedHash: digest.newsletterApprovedHash,
    });
  } catch {
    return false;
  }
}

async function prepareNewsletter(db: ReturnType<typeof getDb>, digest: DigestRow, expectedVersion: number) {
  if (digest.newsletterVersion !== expectedVersion) {
    return conflict("The newsletter changed in another session. Reload before preparing it.", digest.newsletterVersion);
  }
  if (digest.newsletterStatus !== null) {
    return conflict("This Daily Brief already has a prepared newsletter.", digest.newsletterVersion);
  }

  let artifact;
  try {
    artifact = artifactFor(digest);
  } catch (error) {
    return artifactError(error);
  }

  const now = new Date();
  const [prepared] = await db
    .update(digests)
    .set({
      newsletterStatus: "draft",
      newsletterSubject: artifact.subject,
      emailHtml: artifact.html,
      newsletterVersion: sql`${digests.newsletterVersion} + 1`,
      newsletterApprovedHash: null,
      newsletterApprovedAt: null,
      newsletterApprovedBy: null,
      newsletterBroadcastId: null,
      newsletterClaimedAt: null,
      newsletterError: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(digests.id, digest.id),
        eq(digests.status, "published"),
        eq(digests.newsletterVersion, expectedVersion),
        isNull(digests.newsletterStatus),
        isNull(digests.newsletterBroadcastId),
      ),
    )
    .returning({ newsletterVersion: digests.newsletterVersion });

  if (!prepared) return conflict("The newsletter changed while it was being prepared.");
  return response({
    id: digest.id,
    status: "draft",
    newsletterVersion: prepared.newsletterVersion,
    subject: artifact.subject,
  });
}

async function saveNewsletter(
  db: ReturnType<typeof getDb>,
  digest: DigestRow,
  expectedVersion: number,
  subject: string,
) {
  if (digest.newsletterStatus !== "draft" || digest.newsletterBroadcastId) {
    return conflict("Only an unsent draft can be edited.", digest.newsletterVersion);
  }
  if (digest.newsletterVersion !== expectedVersion) {
    return conflict("The newsletter changed in another session. Reload before saving.", digest.newsletterVersion);
  }

  let artifact;
  try {
    artifact = artifactFor(digest, subject);
  } catch (error) {
    return artifactError(error);
  }
  if (digest.newsletterSubject === artifact.subject && digest.emailHtml === artifact.html) {
    return response({
      id: digest.id,
      status: "draft",
      newsletterVersion: digest.newsletterVersion,
      subject: artifact.subject,
      idempotent: true,
    });
  }

  const [saved] = await db
    .update(digests)
    .set({
      newsletterSubject: artifact.subject,
      emailHtml: artifact.html,
      newsletterVersion: sql`${digests.newsletterVersion} + 1`,
      newsletterApprovedHash: null,
      newsletterApprovedAt: null,
      newsletterApprovedBy: null,
      newsletterClaimedAt: null,
      newsletterError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(digests.id, digest.id),
        eq(digests.status, "published"),
        eq(digests.newsletterStatus, "draft"),
        eq(digests.newsletterVersion, expectedVersion),
        isNull(digests.newsletterBroadcastId),
      ),
    )
    .returning({ newsletterVersion: digests.newsletterVersion });

  if (!saved) return conflict("The newsletter changed while it was being saved.");
  return response({
    id: digest.id,
    status: "draft",
    newsletterVersion: saved.newsletterVersion,
    subject: artifact.subject,
  });
}

async function approveNewsletter(db: ReturnType<typeof getDb>, digest: DigestRow, expectedVersion: number) {
  let artifact;
  try {
    artifact = artifactFor(digest, digest.newsletterSubject ?? undefined);
  } catch (error) {
    return artifactError(error);
  }

  if (
    digest.newsletterStatus === "approved" &&
    digest.newsletterVersion === expectedVersion + 1 &&
    digest.newsletterApprovedHash === artifact.approvalHash &&
    currentArtifactIsApproved(digest)
  ) {
    return response({
      id: digest.id,
      status: "approved",
      newsletterVersion: digest.newsletterVersion,
      subject: artifact.subject,
      idempotent: true,
    });
  }
  if (digest.newsletterStatus !== "draft" || digest.newsletterBroadcastId) {
    return conflict("Only an unsent draft can be approved.", digest.newsletterVersion);
  }
  if (digest.newsletterVersion !== expectedVersion) {
    return conflict("The newsletter changed in another session. Reload before approving.", digest.newsletterVersion);
  }
  if (digest.newsletterSubject !== artifact.subject || digest.emailHtml !== artifact.html) {
    return conflict("The deterministic newsletter artifact is stale. Save the draft before approving.", digest.newsletterVersion);
  }

  const now = new Date();
  const [approved] = await db
    .update(digests)
    .set({
      newsletterStatus: "approved",
      newsletterApprovedHash: artifact.approvalHash,
      newsletterApprovedAt: now,
      newsletterApprovedBy: AUTHOR_NAME,
      newsletterVersion: sql`${digests.newsletterVersion} + 1`,
      newsletterClaimedAt: null,
      newsletterError: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(digests.id, digest.id),
        eq(digests.status, "published"),
        eq(digests.newsletterStatus, "draft"),
        eq(digests.newsletterVersion, expectedVersion),
        eq(digests.newsletterSubject, artifact.subject),
        eq(digests.emailHtml, artifact.html),
        isNull(digests.newsletterBroadcastId),
      ),
    )
    .returning({ newsletterVersion: digests.newsletterVersion });

  if (!approved) return conflict("The newsletter changed while it was being approved.");
  return response({
    id: digest.id,
    status: "approved",
    newsletterVersion: approved.newsletterVersion,
    subject: artifact.subject,
  });
}

async function reopenNewsletter(db: ReturnType<typeof getDb>, digest: DigestRow, expectedVersion: number) {
  if (digest.newsletterStatus === "draft" && digest.newsletterVersion === expectedVersion + 1) {
    return response({
      id: digest.id,
      status: "draft",
      newsletterVersion: digest.newsletterVersion,
      subject: digest.newsletterSubject ?? undefined,
      idempotent: true,
    });
  }
  if (!(["approved", "failed"] as const).includes(digest.newsletterStatus as "approved" | "failed")) {
    return conflict("Only an approved or definitively failed newsletter can be reopened.", digest.newsletterVersion);
  }
  if (digest.newsletterBroadcastId) {
    return conflict("A provider draft already exists. Reconcile it instead of reopening or recreating it.", digest.newsletterVersion);
  }
  if (digest.newsletterVersion !== expectedVersion) {
    return conflict("The newsletter changed in another session. Reload before reopening.", digest.newsletterVersion);
  }

  const [reopened] = await db
    .update(digests)
    .set({
      newsletterStatus: "draft",
      newsletterApprovedHash: null,
      newsletterApprovedAt: null,
      newsletterApprovedBy: null,
      newsletterClaimedAt: null,
      newsletterError: null,
      newsletterVersion: sql`${digests.newsletterVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(digests.id, digest.id),
        eq(digests.newsletterVersion, expectedVersion),
        isNull(digests.newsletterBroadcastId),
      ),
    )
    .returning({ newsletterVersion: digests.newsletterVersion });

  if (!reopened) return conflict("The newsletter changed while it was being reopened.");
  return response({
    id: digest.id,
    status: "draft",
    newsletterVersion: reopened.newsletterVersion,
    subject: digest.newsletterSubject ?? undefined,
  });
}

function deliveryErrorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").slice(0, 1_000);
}

async function recordSendingError(
  db: ReturnType<typeof getDb>,
  claim: NewsletterSendClaim,
  error: unknown,
): Promise<void> {
  await db
    .update(digests)
    .set({ newsletterError: deliveryErrorMessage(error), updatedAt: new Date() })
    .where(
      and(
        eq(digests.id, claim.id),
        eq(digests.newsletterStatus, "sending"),
        eq(digests.newsletterVersion, claim.newsletterVersion),
        eq(digests.newsletterApprovedHash, claim.newsletterApprovedHash),
      ),
    );
}

async function settleProviderStatus(
  db: ReturnType<typeof getDb>,
  input: {
    id: number;
    expectedVersion: number;
    broadcastId: string;
    providerStatus: ResendBroadcastStatus;
    currentStatus?: string;
  },
) {
  const target = providerStatusToNewsletterStatus(input.providerStatus);
  if (input.currentStatus === target && target !== "sent") {
    return response({
      id: input.id,
      status: target,
      newsletterVersion: input.expectedVersion,
      broadcastId: input.broadcastId,
      idempotent: true,
    });
  }

  const now = new Date();
  const [settled] = await db
    .update(digests)
    .set({
      newsletterStatus: target,
      newsletterClaimedAt: null,
      newsletterError: null,
      newsletterVersion: sql`${digests.newsletterVersion} + 1`,
      ...(target === "sent" ? { emailSentAt: now } : {}),
      updatedAt: now,
    })
    .where(
      and(
        eq(digests.id, input.id),
        eq(digests.newsletterVersion, input.expectedVersion),
        eq(digests.newsletterBroadcastId, input.broadcastId),
      ),
    )
    .returning({ newsletterVersion: digests.newsletterVersion });
  if (!settled) return conflict("The newsletter changed while provider status was being recorded.");
  return response({
    id: input.id,
    status: target,
    newsletterVersion: settled.newsletterVersion,
    broadcastId: input.broadcastId,
  });
}

async function deliverClaim(db: ReturnType<typeof getDb>, initialClaim: NewsletterSendClaim) {
  let claim = initialClaim;
  let broadcastId = claim.newsletterBroadcastId;

  if (!broadcastId) {
    try {
      const created = await createBroadcastDraft({
        subject: claim.newsletterSubject,
        html: claim.emailHtml,
      });
      broadcastId = created.id;
    } catch (error) {
      if (error instanceof ResendRequestError && !error.ambiguous) {
        const [failed] = await db
          .update(digests)
          .set({
            newsletterStatus: "failed",
            newsletterClaimedAt: null,
            newsletterError: deliveryErrorMessage(error),
            newsletterVersion: sql`${digests.newsletterVersion} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(digests.id, claim.id),
              eq(digests.newsletterStatus, "sending"),
              eq(digests.newsletterVersion, claim.newsletterVersion),
              isNull(digests.newsletterBroadcastId),
            ),
          )
          .returning({ newsletterVersion: digests.newsletterVersion });
        return NextResponse.json(
          {
            error: "Resend rejected broadcast creation. Reopen the failed outbox after correcting configuration.",
            currentVersion: failed?.newsletterVersion ?? claim.newsletterVersion,
          },
          { status: 502 },
        );
      }
      await recordSendingError(db, claim, error);
      return NextResponse.json(
        { error: "Broadcast creation had an uncertain outcome. Do not retry; verify it in Resend before manual recovery." },
        { status: 502 },
      );
    }

    let stored;
    try {
      [stored] = await db
        .update(digests)
        .set({ newsletterBroadcastId: broadcastId, newsletterError: null, updatedAt: new Date() })
        .where(
          and(
            eq(digests.id, claim.id),
            eq(digests.newsletterStatus, "sending"),
            eq(digests.newsletterVersion, claim.newsletterVersion),
            eq(digests.newsletterApprovedHash, claim.newsletterApprovedHash),
            isNull(digests.newsletterBroadcastId),
          ),
        )
        .returning({ id: digests.id });
    } catch (error) {
      await recordSendingError(db, claim, error).catch(() => undefined);
      return NextResponse.json(
        { error: "The provider draft exists, but its ID could not be persisted. It was not sent; inspect Resend before recovery." },
        { status: 502 },
      );
    }
    if (!stored) {
      return conflict("The provider draft exists but the outbox changed before its ID could be recorded. It was not sent.");
    }
    claim = { ...claim, newsletterBroadcastId: broadcastId };
  }

  let provider;
  try {
    provider = await getBroadcast(broadcastId);
  } catch (error) {
    await recordSendingError(db, claim, error);
    return NextResponse.json(
      { error: "The provider draft was recorded but could not be read. Reconcile it; do not create another broadcast." },
      { status: 502 },
    );
  }
  if (provider.id !== broadcastId) {
    await recordSendingError(db, claim, new Error("Resend returned a different broadcast ID."));
    return NextResponse.json({ error: "Resend returned a mismatched broadcast ID. Reconcile manually." }, { status: 502 });
  }
  if (provider.status !== "draft") {
    return settleProviderStatus(db, {
      id: claim.id,
      expectedVersion: claim.newsletterVersion,
      broadcastId,
      providerStatus: provider.status,
      currentStatus: "sending",
    });
  }

  try {
    const sent = await sendBroadcast(broadcastId);
    if (sent.id !== broadcastId) throw new Error("Resend returned a different broadcast ID after send.");
  } catch (error) {
    await recordSendingError(db, claim, error);
    return NextResponse.json(
      { error: "The send response was not safely final. The outbox remains sending; reconcile provider status and do not retry send." },
      { status: 502 },
    );
  }

  return settleProviderStatus(db, {
    id: claim.id,
    expectedVersion: claim.newsletterVersion,
    broadcastId,
    providerStatus: "queued",
    currentStatus: "sending",
  });
}

async function sendNewsletter(db: ReturnType<typeof getDb>, digest: DigestRow, expectedVersion: number) {
  if (digest.newsletterStatus !== "approved") {
    return conflict(
      digest.newsletterStatus === "sending"
        ? "This newsletter has already been claimed. Reconcile it instead of retrying send."
        : "Only an explicitly approved newsletter can be sent.",
      digest.newsletterVersion,
    );
  }
  if (digest.newsletterVersion !== expectedVersion) {
    return conflict("The newsletter changed in another session. Reload before sending.", digest.newsletterVersion);
  }
  if (!currentArtifactIsApproved(digest) || !digest.newsletterApprovedHash) {
    return conflict("The exact deterministic newsletter artifact is not currently approved.", digest.newsletterVersion);
  }
  if (!newsletterDeliveryConfigured()) {
    return configurationError(
      new NewsletterConfigurationError(
        "Resend and NEWSLETTER_POSTAL_ADDRESS must be configured before claiming a send.",
      ),
    );
  }

  let unsyncedCount: number;
  try {
    unsyncedCount = await countActiveUnsyncedSubscribers(db);
  } catch (error) {
    return NextResponse.json(
      { error: `Subscriber synchronization could not be verified: ${deliveryErrorMessage(error)}` },
      { status: 503 },
    );
  }
  if (unsyncedCount > 0) {
    return conflict(
      `${unsyncedCount} active subscriber${unsyncedCount === 1 ? " is" : "s are"} not synced to Resend. Repair the delivery queue before sending.`,
      digest.newsletterVersion,
    );
  }

  const result = await db.execute(
    buildNewsletterSendClaimStatement({
      id: digest.id,
      expectedVersion,
      expectedApprovedHash: digest.newsletterApprovedHash,
      now: new Date(),
    }),
  );
  const [rawClaim] = extractQueryRows<unknown>(result);
  if (!rawClaim) {
    return conflict("The send claim lost a race or an active subscriber is not synced. Reload before taking action.");
  }
  const parsedClaim = newsletterSendClaimSchema.safeParse(rawClaim);
  if (!parsedClaim.success) {
    // No provider request has happened yet. Restore the locally claimed row so a
    // driver/shape regression cannot strand a newsletter in `sending`.
    await db
      .update(digests)
      .set({
        newsletterStatus: "approved",
        newsletterClaimedAt: null,
        newsletterError: "The database returned an invalid newsletter send claim.",
        newsletterVersion: sql`${digests.newsletterVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(digests.id, digest.id),
          eq(digests.newsletterStatus, "sending"),
          eq(digests.newsletterVersion, expectedVersion + 1),
          eq(digests.newsletterApprovedHash, digest.newsletterApprovedHash),
          isNull(digests.newsletterBroadcastId),
        ),
      );
    return NextResponse.json(
      { error: "The database returned an invalid newsletter send claim. No provider request was made." },
      { status: 500 },
    );
  }
  const claim: NewsletterSendClaim = parsedClaim.data;
  return deliverClaim(db, claim);
}

async function reconcileNewsletter(db: ReturnType<typeof getDb>, digest: DigestRow, expectedVersion: number) {
  if (digest.newsletterVersion !== expectedVersion) {
    return conflict("The newsletter changed in another session. Reload before reconciling.", digest.newsletterVersion);
  }
  if (!digest.newsletterBroadcastId) {
    return conflict("No provider broadcast ID is stored. Inspect Resend manually; never recreate an uncertain draft.", digest.newsletterVersion);
  }
  if (digest.newsletterStatus === "sent" || digest.newsletterStatus === "canceled") {
    return response({
      id: digest.id,
      status: digest.newsletterStatus,
      newsletterVersion: digest.newsletterVersion,
      broadcastId: digest.newsletterBroadcastId,
      idempotent: true,
    });
  }
  if (!(digest.newsletterStatus === "sending" || digest.newsletterStatus === "queued" || digest.newsletterStatus === "approved")) {
    return conflict("This newsletter state cannot be reconciled with a provider broadcast.", digest.newsletterVersion);
  }

  let provider;
  try {
    provider = await getBroadcast(digest.newsletterBroadcastId);
  } catch (error) {
    return NextResponse.json(
      { error: `Provider status is unavailable: ${deliveryErrorMessage(error)}` },
      { status: 502 },
    );
  }
  if (provider.id !== digest.newsletterBroadcastId) {
    return NextResponse.json({ error: "Resend returned a mismatched broadcast ID." }, { status: 502 });
  }
  return settleProviderStatus(db, {
    id: digest.id,
    expectedVersion,
    broadcastId: digest.newsletterBroadcastId,
    providerStatus: provider.status,
    currentStatus: digest.newsletterStatus,
  });
}

export async function POST(request: Request) {
  if (!authorizeAdmin(request)) return unauthorized();
  const unsafeRequest = validateMutationRequest(request);
  if (unsafeRequest) return unsafeRequest;

  const parsed = newsletterActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid newsletter action." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const db = getDb();
  const [digest] = await db.select().from(digests).where(eq(digests.id, input.id)).limit(1);
  if (!digest) return NextResponse.json({ error: "Digest not found." }, { status: 404 });

  switch (input.action) {
    case "prepare":
      return prepareNewsletter(db, digest, input.expectedVersion);
    case "save":
      return saveNewsletter(db, digest, input.expectedVersion, input.subject);
    case "approve":
      return approveNewsletter(db, digest, input.expectedVersion);
    case "reopen":
      return reopenNewsletter(db, digest, input.expectedVersion);
    case "send":
      return sendNewsletter(db, digest, input.expectedVersion);
    case "reconcile":
      return reconcileNewsletter(db, digest, input.expectedVersion);
  }
}
