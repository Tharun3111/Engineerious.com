"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Digest, Item, Post, RepurposeJob, Submission } from "@/db/schema";
import { hostname } from "@/lib/dedupe";
import { timeAgo } from "@/lib/time";

/**
 * The human gate. Two queues:
 *   1. Ingested items awaiting approval (only populated when
 *      INGEST_REQUIRE_APPROVAL=true).
 *   2. Repurpose drafts awaiting review — nothing reaches a social account until a
 *      row here is approved.
 *
 * Auth is HTTP Basic, enforced in proxy.ts for /admin and /api/admin. The
 * browser replays the credentials on these fetches, so no token handling here.
 */

async function post(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? `${res.status} ${res.statusText}`);
  return json;
}

function useAction() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // A real, eagerly-set flag, not useTransition's `pending` alone — that only
  // becomes true inside startTransition, which runs AFTER the awaited request
  // already resolved. A fast double-click during the network round-trip would
  // otherwise fire twice with the button never actually disabled for it (confirmed
  // as a real gap on the single-highest-stakes button in the app — digest approve).
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (busy) return undefined;
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      startTransition(() => router.refresh());
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  return { run, pending: busy, error };
}

export function PendingItemsQueue({ items }: { items: Item[] }) {
  const { run, pending, error } = useAction();

  if (items.length === 0) {
    return (
      <p className="text-[13.5px] text-muted">
        Nothing awaiting moderation. New items stay here unless INGEST_REQUIRE_APPROVAL=false.
      </p>
    );
  }

  return (
    <div>
      {error && <p className="mb-2 text-[13px] text-accent-strong">{error}</p>}
      <ul className="divide-y divide-rule">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-start gap-2 py-2">
            <div className="min-w-0 flex-1">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14.5px]"
              >
                {item.title}
              </a>
              <p className="font-mono text-[12px] text-muted">
                {item.source} ({hostname(item.url)}) · {item.type} ·{" "}
                {timeAgo(item.publishedAt ?? item.firstSeen)} · score{" "}
                {item.score.toFixed(3)}
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => post("/api/admin/items", { id: item.id, action: "approve" }))}
                className="btn btn-primary btn-sm disabled:opacity-60"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => post("/api/admin/items", { id: item.id, action: "reject" }))}
                className="btn btn-secondary btn-sm disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RepurposeQueue({ jobs }: { jobs: RepurposeJob[] }) {
  const { run, pending, error } = useAction();
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  if (jobs.length === 0) {
    return (
      <p className="text-[13.5px] text-muted">
        No drafts yet. Generate them with{" "}
        <code className="font-mono">POST /api/repurpose {"{ slug }"}</code>.
      </p>
    );
  }

  return (
    <div>
      {error && <p className="mb-2 text-[13px] text-accent-strong">{error}</p>}
      <ul className="space-y-4">
        {jobs.map((job) => {
          const value = drafts[job.id] ?? job.draft;
          const locked =
            job.status === "approved" || job.status === "published" || job.status === "scheduled";

          return (
            <li key={job.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[12.5px]">
                  <span className="text-accent-strong">{job.platform}</span> · {job.postSlug} ·{" "}
                  <span className="text-muted">{job.status}</span>
                </p>
                {job.publishedUrl && (
                  <a
                    href={job.publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[12px] text-muted"
                  >
                    view post ↗
                  </a>
                )}
              </div>

              <textarea
                value={value}
                readOnly={locked}
                onChange={(event) =>
                  setDrafts((prev) => ({ ...prev, [job.id]: event.target.value }))
                }
                rows={Math.min(16, Math.max(6, value.split("\n").length))}
                className="field mt-2 font-mono text-[12.5px] leading-relaxed"
              />

              {job.error && <p className="mt-1 text-[12.5px] text-accent-strong">{job.error}</p>}

              {!locked && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        post("/api/admin/repurpose", {
                          id: job.id,
                          action: "approve",
                          draft: value,
                        }),
                      )
                    }
                    className="btn btn-primary btn-sm disabled:opacity-60"
                  >
                    Approve copy
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        post("/api/admin/repurpose", { id: job.id, action: "save", draft: value }),
                      )
                    }
                    className="btn btn-secondary btn-sm disabled:opacity-60"
                  >
                    Save edits
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => post("/api/admin/repurpose", { id: job.id, action: "reject" }))
                    }
                    className="btn btn-secondary btn-sm disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              )}
              {job.status === "approved" && (
                <p className="mt-2 text-[12.5px] text-muted">
                  Copy-ready for manual {job.platform} publication. This site has not posted it.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SubmissionsQueue({ submissions }: { submissions: Submission[] }) {
  const { run, pending, error } = useAction();

  if (submissions.length === 0) {
    return <p className="text-[13.5px] text-muted">No community submissions pending.</p>;
  }

  return (
    <div>
      {error && <p className="mb-2 text-[13px] text-accent-strong">{error}</p>}
      <ul className="divide-y divide-rule">
        {submissions.map((submission) => (
          <li key={submission.id} className="flex flex-wrap items-start gap-2 py-2">
            <div className="min-w-0 flex-1">
              <a href={submission.url} target="_blank" rel="noopener noreferrer" className="text-[14.5px]">
                {submission.title}
              </a>
              <p className="font-mono text-[12px] text-muted">
                {submission.type} · {hostname(submission.url)} · {timeAgo(submission.createdAt)}
                {submission.submitterEmail ? ` · ${submission.submitterEmail}` : ""}
              </p>
              {submission.note && <p className="text-[13px] text-muted">{submission.note}</p>}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => post("/api/admin/submissions", { id: submission.id, action: "accept" }))
                }
                className="btn btn-primary btn-sm disabled:opacity-60"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => post("/api/admin/submissions", { id: submission.id, action: "reject" }))
                }
                className="btn btn-secondary btn-sm disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type ReviewReport = {
  groundingViolations: Array<{ quote: string; issue: string }>;
  voiceViolations: Array<{ quote: string; issue: string }>;
  overallVerdict: string;
  readsAsGenericAiContent: boolean;
};

/** The daily-pipeline human gate. Approval publishes only the web artifact;
 * newsletter delivery is a separate reviewed action. */
export function DigestQueue({ rows }: { rows: Array<{ digest: Digest; post: Post | null }> }) {
  const { run, pending, error } = useAction();
  const [expanded, setExpanded] = useState<number | null>(null);

  if (rows.length === 0) {
    return <p className="text-[13.5px] text-muted">No digests awaiting review.</p>;
  }

  return (
    <div>
      {error && <p className="mb-2 text-[13px] text-accent-strong">{error}</p>}
      <ul className="space-y-4">
        {rows.map(({ digest, post: postRow }) => {
          const review = (digest.reviewReport as ReviewReport | null) ?? null;
          const isOpen = expanded === digest.id;
          const issueCount = (review?.groundingViolations.length ?? 0) + (review?.voiceViolations.length ?? 0);
          const publishBlocked =
            !review || issueCount > 0 || review.readsAsGenericAiContent || !postRow;

          return (
            <li key={digest.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[12.5px] text-muted">
                    {digest.date} · digest #{digest.id}
                  </p>
                  <p className="text-[15px] font-semibold">{postRow?.title ?? "(no post found)"}</p>
                  {postRow?.dek && <p className="text-[13.5px] text-muted">{postRow.dek}</p>}
                </div>
                <span className={issueCount > 0 ? "pill pill-accent" : "pill"}>
                  {issueCount > 0 ? `${issueCount} review flag${issueCount === 1 ? "" : "s"}` : "no flags"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : digest.id)}
                className="btn btn-secondary btn-sm mt-3"
              >
                {isOpen ? "Hide" : "Review"} full draft
              </button>

              {isOpen && (
                <div className="mt-3 space-y-3">
                  {review && (
                    <div className="rounded-md border border-rule p-3 text-[12.5px]">
                      <p className="font-semibold">{review.overallVerdict}</p>
                      {review.readsAsGenericAiContent && (
                        <p className="mt-1 text-accent-strong">Flagged: reads as generic AI content.</p>
                      )}
                      {review.groundingViolations.map((v, i) => (
                        <p key={`g${i}`} className="mt-2">
                          <span className="font-semibold text-accent-strong">Grounding:</span> &quot;{v.quote}&quot; — {v.issue}
                        </p>
                      ))}
                      {review.voiceViolations.map((v, i) => (
                        <p key={`v${i}`} className="mt-2">
                          <span className="font-semibold text-accent-strong">Voice:</span> &quot;{v.quote}&quot; — {v.issue}
                        </p>
                      ))}
                    </div>
                  )}
                  {postRow?.tldr && (
                    <p className="field text-[13px] leading-relaxed">
                      <span className="font-semibold">TL;DR:</span> {postRow.tldr}
                    </p>
                  )}
                  {postRow?.keyFacts && (postRow.keyFacts as string[]).length > 0 && (
                    <ul className="field space-y-1 text-[13px] leading-relaxed">
                      {(postRow.keyFacts as string[]).map((fact, i) => (
                        <li key={i}>• {fact}</li>
                      ))}
                    </ul>
                  )}
                  {postRow?.relevantTickers && (postRow.relevantTickers as string[]).length > 0 && (
                    <p className="field font-mono text-[12.5px]">
                      <span className="font-semibold">Tickers:</span>{" "}
                      {(postRow.relevantTickers as string[]).join(", ")}
                    </p>
                  )}
                  {postRow?.diagram && (
                    <div className="field text-[13px] leading-relaxed">
                      <span className="font-semibold">
                        Diagram ({postRow.diagram.type}): {postRow.diagram.title}
                      </span>
                      <ol className="mt-1 list-decimal space-y-1 pl-5">
                        {postRow.diagram.steps.map((s, i) => (
                          <li key={i}>
                            <span className="font-semibold">{s.label}:</span> {s.detail}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {postRow?.body && (
                    <pre className="field max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed">
                      {postRow.body}
                    </pre>
                  )}
                  {digest.emailHtml && (
                    <details className="text-[12.5px]">
                      <summary className="cursor-pointer text-muted">Email preview (raw HTML)</summary>
                      <pre className="field mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-[11px]">
                        {digest.emailHtml}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={pending || publishBlocked}
                  onClick={() =>
                    run(() => post("/api/admin/digests", { id: digest.id, action: "approve" }))
                  }
                  className="btn btn-primary btn-sm disabled:opacity-60"
                  aria-disabled={publishBlocked}
                  title={publishBlocked ? "Resolve review flags before publishing." : undefined}
                >
                  Approve &amp; publish
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => post("/api/admin/digests", { id: digest.id, action: "reject" }))}
                  className="btn btn-secondary btn-sm disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
