import type { Metadata } from "next";

import {
  PendingItemsQueue,
  RepurposeQueue,
  SubmissionsQueue,
} from "@/components/AdminQueue";
import { getPendingItems, getRepurposeQueue, getSubmissions } from "@/lib/queries";
import { llmConfigured } from "@/lib/llm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/** Gated by HTTP Basic in middleware.ts. Nothing here is reachable unauthenticated. */
export default async function AdminPage() {
  const [pending, queue, subs] = await Promise.all([
    getPendingItems(),
    getRepurposeQueue(),
    getSubmissions(),
  ]);

  const errors = [pending.error, queue.error, subs.error].filter(Boolean);

  return (
    <div className="space-y-8 py-8">
      <header className="space-y-1.5">
        <p className="eyebrow">Internal</p>
        <h1 className="text-[24px] font-bold tracking-tight">Admin</h1>
        <p className="font-mono text-[12px] text-muted">
          distribution: manual LinkedIn copy · llm:{" "}
          {llmConfigured() ? "configured" : "not configured"}
        </p>
      </header>

      {errors.length > 0 && (
        <p role="alert" className="card p-4 font-mono text-[12.5px]">
          {errors[0]}
        </p>
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
