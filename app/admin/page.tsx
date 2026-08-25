import type { Metadata } from "next";

import { AiCurationQueue } from "@/components/AiCurationQueue";
import {
  DigestQueue,
  PendingItemsQueue,
  RepurposeQueue,
  SubmissionsQueue,
} from "@/components/AdminQueue";
import { DailyDigestEditor } from "@/components/DailyDigestEditor";
import {
  factualContentHash,
  myTakeContentHash,
  parseDailyBriefDraft,
} from "@/lib/daily-brief";
import { getPostRow } from "@/lib/content/sync";
import { getCuratedAiAdminQueue } from "@/lib/curated-ai-queries";
import { getPendingDigests, getPendingItems, getRepurposeQueue, getSubmissions } from "@/lib/queries";
import { llmConfigured } from "@/lib/llm";
import { resendConfigured } from "@/lib/resend";
import { reviewSchema } from "@/lib/review";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/** Gated by HTTP Basic in proxy.ts. Nothing here is reachable unauthenticated. */
export default async function AdminPage() {
  const [pending, queue, subs, pendingDigests, curatedAi] = await Promise.all([
    getPendingItems(),
    getRepurposeQueue(),
    getSubmissions(),
    getPendingDigests(),
    getCuratedAiAdminQueue(),
  ]);

  const legacyDigests = pendingDigests.digests.filter((digest) => !digest.dailyDraft);
  const digestRows = await Promise.all(
    legacyDigests.map(async (digest) => ({
      digest,
      post: digest.blogPostSlug ? await getPostRow(digest.blogPostSlug) : null,
    })),
  );

  const dailyErrors: string[] = [];
  const dailyRecords = pendingDigests.digests.flatMap((digest) => {
    if (!digest.dailyDraft) return [];
    try {
      const draft = parseDailyBriefDraft(digest.dailyDraft);
      const review = reviewSchema.safeParse(digest.reviewReport);
      return [
        {
          key: `${digest.id}:${digest.updatedAt.toISOString()}`,
          record: {
            id: digest.id,
            date: digest.date,
            status: digest.status,
            draftVersion: digest.draftVersion,
            draft,
            reviewReport: review.success ? review.data : null,
            reviewCurrent: digest.reviewedContentHash === factualContentHash(draft),
            myTakeConfirmed:
              Boolean(digest.myTakeConfirmedAt && digest.myTakeConfirmedBy) &&
              digest.myTakeConfirmedHash === myTakeContentHash(draft.myTake),
            reviewedAt: digest.reviewedAt?.toISOString() ?? null,
            myTakeConfirmedAt: digest.myTakeConfirmedAt?.toISOString() ?? null,
          },
        },
      ];
    } catch (error) {
      dailyErrors.push(
        `Digest #${digest.id} has an invalid structured draft: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  });

  const errors = [
    pending.error,
    queue.error,
    subs.error,
    pendingDigests.error,
    curatedAi.error,
    ...dailyErrors,
  ].filter(Boolean);

  return (
    <div className="space-y-8 py-8">
      <header className="space-y-1.5">
        <p className="eyebrow">Internal</p>
        <h1 className="text-[24px] font-bold tracking-tight">Admin</h1>
        <p className="font-mono text-[12px] text-muted">
          distribution: manual LinkedIn/Instagram copy · llm: {llmConfigured() ? "configured" : "not configured"}
          {" · "}newsletter: {resendConfigured() ? "configured" : "not configured"}
        </p>
      </header>

      {errors.length > 0 && (
        <p role="alert" className="card p-4 font-mono text-[12.5px]">
          {errors[0]}
        </p>
      )}

      <section className="card p-5">
        <h2 className="text-[15px] font-semibold">
          Daily Brief editor{" "}
          <span className="font-mono text-[12px] font-normal text-muted">
            ({dailyRecords.length})
          </span>
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          Edit the structured brief, inspect its evidence, review the factual revision, then add and confirm My Take.
        </p>
        <div className="mt-4 space-y-5">
          {dailyRecords.length > 0 ? (
            dailyRecords.map(({ key, record }) => <DailyDigestEditor key={key} record={record} />)
          ) : (
            <p className="text-[13.5px] text-muted">No structured Daily Briefs awaiting review.</p>
          )}
        </div>
      </section>

      {digestRows.length > 0 && (
        <section className="card p-5">
          <h2 className="text-[15px] font-semibold">
            Legacy digest recovery{" "}
            <span className="font-mono text-[12px] font-normal text-muted">
              ({digestRows.length})
            </span>
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            Pre-structured drafts remain recoverable until their queue is empty.
          </p>
          <div className="mt-3">
            <DigestQueue rows={digestRows} />
          </div>
        </section>
      )}

      <section className="card p-5">
        <h2 className="text-[15px] font-semibold">
          Repurpose queue{" "}
          <span className="font-mono text-[12px] font-normal text-muted">
            ({queue.jobs.length})
          </span>
        </h2>
        <div className="mt-3">
          <RepurposeQueue jobs={queue.jobs} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-[15px] font-semibold">
          Curated AI desk{" "}
          <span className="font-mono text-[12px] font-normal text-muted">
            ({curatedAi.items.length})
          </span>
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          Review approved ingestion records into immutable public snapshots. Approval alone never publishes to the AI desk.
        </p>
        <div className="mt-4">
          <AiCurationQueue items={curatedAi.items} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-[15px] font-semibold">
          Ingested items awaiting approval{" "}
          <span className="font-mono text-[12px] font-normal text-muted">
            ({pending.items.length})
          </span>
        </h2>
        <div className="mt-3">
          <PendingItemsQueue items={pending.items} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-[15px] font-semibold">
          Community submissions{" "}
          <span className="font-mono text-[12px] font-normal text-muted">
            ({subs.submissions.length})
          </span>
        </h2>
        <div className="mt-3">
          <SubmissionsQueue submissions={subs.submissions} />
        </div>
      </section>
    </div>
  );
}
