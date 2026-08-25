"use client";

import { useId, useState } from "react";

type ShareActionsProps = {
  title: string;
  text: string;
  url: string;
};

type ShareStatus = "" | "Shared." | "Link copied." | "Share canceled." | "Copy failed.";

function legacyCopy(value: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // The Clipboard API can be unavailable outside a secure context. The
    // selection fallback below keeps the control useful in that case.
  }

  try {
    return legacyCopy(value);
  } catch {
    return false;
  }
}

export function ShareActions({ title, text, url }: ShareActionsProps) {
  const [status, setStatus] = useState<ShareStatus>("");
  const statusId = useId();
  const emailBody = `${text}\n\n${url}`;
  const xText = `${title} — ${text}`;

  async function copyLink() {
    setStatus((await copyToClipboard(url)) ? "Link copied." : "Copy failed.");
  }

  async function share() {
    setStatus("");
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        setStatus("Shared.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setStatus("Share canceled.");
          return;
        }
      }
    }

    await copyLink();
  }

  return (
    <div>
      <div className="mt-4 flex flex-wrap gap-2" aria-describedby={statusId}>
        <button type="button" onClick={share} className="btn btn-primary">
          Share
        </button>
        <button type="button" onClick={copyLink} className="btn btn-secondary">
          Copy link
        </button>
        <a
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(emailBody)}`}
          className="btn btn-ghost"
          aria-label="Share by email"
        >
          Email
        </a>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost"
          aria-label="Share on LinkedIn (opens in a new tab)"
        >
          LinkedIn <span aria-hidden="true">&nearr;</span>
        </a>
        <a
          href={`https://x.com/intent/post?text=${encodeURIComponent(xText)}&url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost"
          aria-label="Share on X (opens in a new tab)"
        >
          X <span aria-hidden="true">&nearr;</span>
        </a>
      </div>
      <p id={statusId} role="status" aria-live="polite" className="mt-2 min-h-5 font-mono text-[10.5px] text-muted">
        {status}
      </p>
    </div>
  );
}
