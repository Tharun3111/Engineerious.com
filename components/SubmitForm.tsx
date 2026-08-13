"use client";

import { useState } from "react";

import { SECTIONS } from "@/lib/sections";

type Status = "idle" | "submitting" | "ok" | "error";

/** Community submissions land in the moderation queue — nothing goes straight to a feed. */
export function SubmitForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    setStatus("submitting");
    setMessage("");

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? "We couldn't submit this link. Try again in a few minutes.");
      }

      setStatus("ok");
      setMessage("Link submitted for review. Thanks for the tip.");
      form.reset();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "We couldn't submit this link. Try again in a few minutes.",
      );
    }
  }

  const label = "block text-[13px] font-medium";

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6" data-testid="submit-form">
      <div>
        <label htmlFor="submit-url" className={label}>
          URL
        </label>
        <input id="submit-url" name="url" type="url" required placeholder="https://example.com/ai-release" className="field mt-1.5" />
      </div>

      <div>
        <label htmlFor="submit-title" className={label}>
          Title
        </label>
        <input id="submit-title" name="title" type="text" required maxLength={200} placeholder="Acme releases Model 2" className="field mt-1.5" />
      </div>

      <div>
        <label htmlFor="submit-type" className={label}>
          Section
        </label>
        <select id="submit-type" name="type" required defaultValue="news" className="field mt-1.5">
          {SECTIONS.map((section) => (
            <option key={section.type} value={section.type}>
              {section.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="submit-note" className={label}>
          Why it matters <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="submit-note" name="note" type="text" maxLength={280} placeholder="Adds tool use and a longer context window" className="field mt-1.5" />
      </div>

      <div>
        <label htmlFor="submit-email" className={label}>
          Your email <span className="font-normal text-muted">(optional, for credit)</span>
        </label>
        <input id="submit-email" name="submitterEmail" type="email" placeholder="you@example.com" className="field mt-1.5" />
      </div>

      <button type="submit" disabled={status === "submitting"} className="btn btn-primary disabled:opacity-60">
        {status === "submitting" ? "Submitting…" : "Submit link"}
      </button>

      {message && (
        <p
          role="status"
          data-submit-status={status}
          className={`text-[13px] ${status === "error" ? "text-accent-strong" : "text-muted"}`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
