"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import type { NewsletterQueueRecord } from "@/lib/newsletter-queries";
import type { NewsletterActionRequest, NewsletterActionResult } from "@/lib/newsletter";
import type { SubscriberDeliveryRecord } from "@/lib/subscriber-queries";

type NewsletterAction = NewsletterActionRequest["action"];
type NewsletterMutationResponse = Partial<NewsletterActionResult> & {
  error?: string;
  currentVersion?: number;
};

const ACTION_LABELS: Record<NewsletterAction, { idle: string; busy: string; done: string }> = {
  prepare: { idle: "Prepare newsletter", busy: "Preparing…", done: "Newsletter prepared" },
  save: { idle: "Save subject", busy: "Saving…", done: "Subject saved" },
  approve: { idle: "Approve newsletter", busy: "Approving…", done: "Newsletter approved" },
  send: { idle: "Send newsletter", busy: "Sending…", done: "Newsletter send started" },
  reconcile: { idle: "Reconcile provider", busy: "Reconciling…", done: "Provider status reconciled" },
  reopen: { idle: "Reopen draft", busy: "Reopening…", done: "Newsletter reopened" },
};

function chicagoDateTime(value: string | null): string {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Chicago",
  }).format(new Date(value));
}

function statusLabel(status: NewsletterQueueRecord["newsletterStatus"]): string {
  return status?.replaceAll("_", " ") ?? "not prepared";
}

function NewsletterCard({ record }: { record: NewsletterQueueRecord }) {
  const router = useRouter();
  const fieldId = useId();
  const [, startTransition] = useTransition();
  const [subject, setSubject] = useState(record.newsletterSubject ?? "");
  const [busyAction, setBusyAction] = useState<NewsletterAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = record.newsletterStatus;
  const subjectDirty = subject !== (record.newsletterSubject ?? "");
  const canReopen =
    (status === "approved" || status === "failed") && !record.newsletterBroadcastId;
  const canReconcile =
    Boolean(record.newsletterBroadcastId) &&
    (status === "sending" || status === "queued" || status === "approved");

  async function run(action: NewsletterAction) {
    if (busyAction) return;
    setBusyAction(action);
    setMessage(null);
    setError(null);

    const body: NewsletterActionRequest =
      action === "save"
        ? { id: record.id, action, expectedVersion: record.newsletterVersion, subject }
        : { id: record.id, action, expectedVersion: record.newsletterVersion };
    try {
      const response = await fetch("/api/admin/newsletters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as NewsletterMutationResponse;
      if (!response.ok || !result.ok) {
        const revision =
          result.currentVersion === undefined
            ? ""
            : ` Current revision: ${result.currentVersion}.`;
        throw new Error(`${result.error ?? "Newsletter action failed."}${revision}`);
      }
      setMessage(
        `${ACTION_LABELS[action].done}${result.idempotent ? "; it was already current" : ""}.`,
      );
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Newsletter action failed. Reload the queue and try again.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  function confirmed(action: "approve" | "send" | "reopen") {
    const prompt =
      action === "send"
        ? "Send this exact approved newsletter to every active synced subscriber? This starts an external broadcast and can't be undone from Engineerious."
        : action === "approve"
          ? "Approve this exact subject and preview for delivery? Any later edit will require a new approval."
          : "Reopen this newsletter draft? This removes the current approval before any edits are allowed.";
    if (window.confirm(prompt)) void run(action);
  }

  const buttonLabel = (action: NewsletterAction) =>
    busyAction === action ? ACTION_LABELS[action].busy : ACTION_LABELS[action].idle;

  return (
    <li className="rounded-md border border-rule p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule pb-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
            Published structured Daily · {record.date}
          </p>
          <h3 className="mt-1 text-[17px] font-semibold leading-snug">{record.dailyTitle}</h3>
          <p className="mt-1 text-[12px] text-muted">
            Web snapshot published {chicagoDateTime(record.publishedAt)} CT · outbox revision{" "}
            {record.newsletterVersion}
          </p>
        </div>
        <span className={status === "approved" || status === "sent" ? "pill pill-accent" : "pill"}>
          {statusLabel(status)}
        </span>
      </div>

      {(message || error) && (
        <p
          role={error ? "alert" : "status"}
          className={`mt-3 text-[13px] ${error ? "font-medium text-alarm" : "text-positive"}`}
        >
          {error ?? message}
        </p>
      )}

      {record.newsletterError && (
        <div className="mt-4 rounded-md border border-rule bg-surface-2 p-3">
          <p className="eyebrow text-alarm">Provider or outbox error</p>
          <p className="mt-1 break-words text-[13px] text-alarm">{record.newsletterError}</p>
        </div>
      )}

      {status === null ? (
        <div className="mt-4">
          <p className="max-w-2xl text-[13px] leading-5 text-muted">
            Preparation creates a deterministic email from the published Daily snapshot. It does not
            approve or send anything.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm mt-3 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={Boolean(busyAction)}
            onClick={() => void run("prepare")}
          >
            {buttonLabel("prepare")}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor={`${fieldId}-subject`} className="block text-[13px] font-semibold">
              Subject
            </label>
            <input
              id={`${fieldId}-subject`}
              value={subject}
              maxLength={200}
              readOnly={status !== "draft"}
              aria-describedby={`${fieldId}-subject-help`}
              onChange={(event) => setSubject(event.target.value)}
              className="field mt-1 read-only:cursor-default read-only:bg-surface-2"
            />
            <p id={`${fieldId}-subject-help`} className="mt-1 text-[12px] text-muted">
              {status === "draft"
                ? `${subject.length}/200 characters${subjectDirty ? " · unsaved" : ""}`
                : "Read-only after approval. Reopen the draft before editing."}
            </p>
          </div>

          {record.emailHtml ? (
            <details className="rounded-md border border-rule bg-surface-2 p-3">
              <summary className="min-h-11 cursor-pointer py-2 text-[13px] font-semibold">
                Review sandboxed email preview
              </summary>
              <p className="mb-3 text-[12px] leading-5 text-muted">
                The preview cannot run scripts, access Engineerious, or open a new window.
              </p>
              <iframe
                title={`Newsletter preview for ${record.date}`}
                srcDoc={record.emailHtml}
                sandbox=""
                referrerPolicy="no-referrer"
                loading="lazy"
                className="h-[430px] w-full rounded-sm border border-rule bg-white"
              />
            </details>
          ) : (
            <p role="alert" className="text-[13px] text-alarm">
              The prepared email preview is missing. Reopen or prepare the outbox before approval.
            </p>
          )}

          <dl className="grid gap-2 rounded-md bg-surface-2 p-3 text-[12px] sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-fg">Approval</dt>
              <dd className="mt-0.5 text-muted">
                {record.newsletterApprovedAt
                  ? `${record.newsletterApprovedBy ?? "Reviewer"} · ${chicagoDateTime(record.newsletterApprovedAt)} CT`
                  : "Not approved"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-fg">Provider broadcast</dt>
              <dd className="mt-0.5 break-all font-mono text-muted">
                {record.newsletterBroadcastId ?? "Not created"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-fg">Send claim</dt>
              <dd className="mt-0.5 text-muted">{chicagoDateTime(record.newsletterClaimedAt)} CT</dd>
            </div>
            <div>
              <dt className="font-semibold text-fg">Sent</dt>
              <dd className="mt-0.5 text-muted">{chicagoDateTime(record.emailSentAt)} CT</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2" aria-label={`Newsletter actions for ${record.date}`}>
            {status === "draft" && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(busyAction) || !subjectDirty || subject.trim().length === 0}
                  onClick={() => void run("save")}
                >
                  {buttonLabel("save")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(busyAction) || subjectDirty || !record.emailHtml}
                  onClick={() => confirmed("approve")}
                >
                  {buttonLabel("approve")}
                </button>
              </>
            )}
            {status === "approved" && (
              <button
                type="button"
                className="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={Boolean(busyAction)}
                onClick={() => confirmed("send")}
              >
                {buttonLabel("send")}
              </button>
            )}
            {canReconcile && (
              <button
                type="button"
                className="btn btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={Boolean(busyAction)}
                onClick={() => void run("reconcile")}
              >
                {buttonLabel("reconcile")}
              </button>
            )}
            {canReopen && (
              <button
                type="button"
                className="btn btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={Boolean(busyAction)}
                onClick={() => confirmed("reopen")}
              >
                {buttonLabel("reopen")}
              </button>
            )}
          </div>

          {status === "approved" && (
            <p className="text-[12px] leading-5 text-muted">
              Approval does not send. Send claims this revision, creates a provider draft only when
              none is recorded, then issues the separate provider send request. Unsynced active
              subscribers block the claim.
            </p>
          )}
          {status === "sending" && !record.newsletterBroadcastId && (
            <p className="text-[12px] leading-5 text-alarm">
              No provider broadcast ID is recorded after an uncertain creation response. Do not
              send or reconcile automatically. Inspect Resend before manual recovery.
            </p>
          )}
          {(status === "queued" || (status === "sending" && record.newsletterBroadcastId)) && (
            <p className="text-[12px] leading-5 text-muted">
              Do not send again. Reconcile reads the recorded provider broadcast and updates this
              outbox without creating a duplicate.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function NewsletterQueue({
  newsletters,
  error,
}: {
  newsletters: NewsletterQueueRecord[];
  error?: string | null;
}) {
  if (newsletters.length === 0) {
    if (error) {
      return (
        <p role="alert" className="text-[13px] text-alarm">
          Newsletter candidates are unavailable. Do not prepare or send until this check succeeds. {error}
        </p>
      );
    }
    return (
      <p className="text-[13.5px] text-muted">
        No published structured Daily Brief is ready for newsletter preparation.
      </p>
    );
  }
  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-[13px] text-alarm">
          {error}
        </p>
      )}
      <ul className="space-y-4">
        {newsletters.map((record) => (
          <NewsletterCard key={`${record.id}:${record.newsletterVersion}`} record={record} />
        ))}
      </ul>
    </div>
  );
}

function SubscriberRepairCard({ subscriber }: { subscriber: SubscriberDeliveryRecord }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    if (busy) return;
    if (!window.confirm(`Retry provider contact sync for ${subscriber.email}?`)) {
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/subscribers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "retry_sync", id: subscriber.id }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Contact sync failed. Check provider setup and try again.");
      }
      setMessage("Contact synced for delivery.");
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Contact sync failed. Check provider setup and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-md border border-rule p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-all text-[14px] font-semibold">{subscriber.email}</p>
          <p className="mt-1 text-[12px] text-muted">
            Captured {chicagoDateTime(subscriber.subscribedAt)} CT · last sync attempt{" "}
            {chicagoDateTime(subscriber.resendSyncAttemptedAt)} CT
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => void retry()}
        >
          {busy ? "Retrying…" : "Retry contact sync"}
        </button>
      </div>
      {subscriber.resendSyncError && (
        <div className="mt-3 space-y-1 rounded-md bg-surface-2 p-3 text-[12px] text-alarm">
          <p>Contact sync: {subscriber.resendSyncError}</p>
        </div>
      )}
      {(message || error) && (
        <p
          role={error ? "alert" : "status"}
          className={`mt-3 text-[13px] ${error ? "font-medium text-alarm" : "text-positive"}`}
        >
          {error ?? message}
        </p>
      )}
    </li>
  );
}

export function SubscriberDeliveryQueue({
  subscribers,
  total,
  error,
}: {
  subscribers: SubscriberDeliveryRecord[];
  total: number;
  error?: string | null;
}) {
  if (error) {
    return (
      <p role="alert" className="text-[13px] text-alarm">
        Subscriber delivery status is unavailable. Do not send until this check succeeds. {error}
      </p>
    );
  }
  if (subscribers.length === 0) {
    return (
      <p className="text-[13.5px] text-muted">
        All active captured subscribers are synced for newsletter delivery.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-[12.5px] leading-5 text-muted">
        {total} active captured subscriber{total === 1 ? " is" : "s are"} missing a provider
        contact ID. Newsletter sends stay blocked until this queue is empty.
      </p>
      <ul className="space-y-3">
        {subscribers.map((subscriber) => (
          <SubscriberRepairCard key={subscriber.id} subscriber={subscriber} />
        ))}
      </ul>
      {total > subscribers.length && (
        <p className="mt-3 text-[12px] text-muted">
          Showing {subscribers.length} of {total}. Repair these records, then refresh for the next
          bounded page.
        </p>
      )}
    </div>
  );
}
