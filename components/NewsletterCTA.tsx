"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "ok" | "error";

/**
 * Posts to our own /api/subscribe rather than embedding beehiiv's script, so the
 * form works with third-party scripts blocked and /qa can assert on the response.
 */
export function NewsletterCTA({
  variant = "inline",
  heading = "Get practical AI engineering notes",
  blurb = "Receive source-checked analysis of models, agents, evaluation, retrieval, and production reliability. Sent only when there is useful work to share.",
  hideHeading = false,
}: {
  variant?: "inline" | "compact";
  heading?: string;
  blurb?: string;
  /** Skip the eyebrow+heading pair — for pages that already have an equivalent
   *  H1 immediately above this component, so the two don't repeat each other. */
  hideHeading?: boolean;
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

      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? "We couldn't add this email. Try again in a few minutes.");
      }
      setStatus("ok");
      setMessage("You're subscribed. Check your inbox to confirm.");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "We couldn't add this email. Try again in a few minutes.",
      );
    }
  }

  const compact = variant === "compact";

  return (
    <section
      data-testid="newsletter-cta"
      className={compact ? "border-t border-rule pt-7" : "border-y border-rule py-10 sm:py-12"}
    >
      <div>
        {!hideHeading && (
          <>
            <p className="eyebrow">Newsletter</p>
            <h2 className={compact ? "font-display mt-2 text-[27px] font-semibold leading-tight" : "font-display mt-2 text-[36px] font-semibold leading-tight"}>
              {heading}
            </h2>
          </>
        )}
        <p
          className={
            hideHeading
              ? "max-w-2xl text-[17px] leading-7 text-muted"
              : compact
                ? "mt-2 max-w-xl text-[16px] leading-6 text-muted"
                : "mt-3 max-w-2xl text-[17px] leading-7 text-muted"
          }
        >
          {blurb}
        </p>

        <form onSubmit={onSubmit} className="mt-6 max-w-2xl">
          <label htmlFor="newsletter-email" className="block text-[14px] font-semibold text-fg">
            Email address
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="newsletter-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="field min-w-0 flex-1"
            />
            <button type="submit" disabled={status === "submitting"} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60">
              {status === "submitting" ? "Subscribing…" : "Subscribe for updates"}
            </button>
          </div>
        </form>

        {message && (
          <p
            role="status"
            data-subscribe-status={status}
            className={`mt-3 text-[14px] ${status === "error" ? "font-medium text-[#9b2c1f]" : "text-muted"}`}
          >
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
