"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Item, RepurposeJob, Submission } from "@/db/schema";
import { hostname } from "@/lib/dedupe";
import { timeAgo } from "@/lib/time";

/**
 * The human gate. Two queues:
 *   1. Ingested items awaiting approval (only populated when
 *      INGEST_REQUIRE_APPROVAL=true).
 *   2. Repurpose drafts awaiting review — nothing reaches a social account until a
 *      row here is approved.
 *
 * Auth is HTTP Basic, enforced in middleware.ts for /admin and /api/admin. The
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return { run, pending, error };
}

export function PendingItemsQueue({ items }: { items: Item[] }) {
  const { run, pending, error } = useAction();

  if (items.length === 0) {
    return (
      <p className="text-[13.5px] text-muted">
        Nothing awaiting moderation. Items auto-approve unless INGEST_REQUIRE_APPROVAL=true.
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
                  Copy-ready for manual LinkedIn publication. This site has not posted it.
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
