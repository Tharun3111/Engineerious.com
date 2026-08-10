"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "ok" | "error";

/**
 * Posts to our own /api/subscribe rather than embedding beehiiv's script, so the
 * form works with third-party scripts blocked and /qa can assert on the response.
 */
export function NewsletterCTA({
  variant = "inline",
  heading = "The Engineerious newsletter",
  blurb = "Occasional notes on practical AI engineering — sent when there is something worth sharing.",
}: {
  variant?: "inline" | "compact";
  heading?: string;
  blurb?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !body.ok) throw new Error(body.error ?? "Subscription failed.");
      setStatus("ok");
      setMessage("Subscribed. Check your inbox for the confirmation.");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Subscription failed.");
    }
  }

  const compact = variant === "compact";

  return (
    <section
      data-testid="newsletter-cta"
      className={
        compact
          ? "card p-5"
          : "card relative overflow-hidden p-7 sm:p-9"
      }
    >
      {!compact && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent-tint blur-2xl"
        />
      )}
      <div className="relative">
        <p className="eyebrow">Newsletter</p>
        <h2 className={compact ? "mt-1 text-[16px] font-semibold" : "mt-1.5 text-[21px] font-bold tracking-tight"}>
          {heading}
        </h2>
        <p className={compact ? "mt-1 text-[13.5px] text-muted" : "mt-1.5 max-w-md text-[14.5px] text-muted"}>
          {blurb}
        </p>

        <form onSubmit={onSubmit} className="mt-4 flex flex-wrap gap-2">
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className="min-w-0 flex-1 rounded-full border border-rule-strong bg-surface px-4 py-2 text-[14px] outline-none placeholder:text-muted focus:border-accent"
          />
          <button type="submit" disabled={status === "submitting"} className="btn btn-primary disabled:opacity-60">
            {status === "submitting" ? "Subscribing…" : "Subscribe"}
          </button>
        </form>

        {message && (
          <p
            role="status"
            data-subscribe-status={status}
            className={`mt-2.5 text-[13px] ${status === "error" ? "text-accent-strong" : "text-muted"}`}
          >
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
