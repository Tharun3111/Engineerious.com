import { env } from "@/lib/env";
import type { BlogPost } from "@/lib/content/blog";

/**
 * beehiiv v2 API. Two uses:
 *   1. `subscribe()` — server-side signup, so /subscribe posts to our own route and
 *      we keep the email even if the beehiiv embed script is blocked.
 *   2. `createBroadcastDraft()` — turn a published post into a newsletter draft.
 *      A draft, never a send: the newsletter gets the same human gate as social.
 *
 * With no BEEHIIV_API_KEY set, /subscribe falls back to the plain embed iframe
 * (NEXT_PUBLIC_BEEHIIV_EMBED_URL) and this module reports itself unconfigured.
 */

const API = "https://api.beehiiv.com/v2";

export function beehiivConfigured(): boolean {
  return Boolean(env.beehiivApiKey && env.beehiivPublicationId);
}

async function beehiiv<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API}/publications/${env.beehiivPublicationId}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.beehiivApiKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`beehiiv ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function subscribe(email: string, referringSite?: string) {
  if (!beehiivConfigured()) throw new Error("beehiiv is not configured");
  return beehiiv<{ data?: { id: string; status: string } }>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      email,
      reactivate_existing: false,
      send_welcome_email: true,
      utm_source: "engineerious.com",
      referring_site: referringSite ?? env.siteUrl,
    }),
  });
}

/** Creates a draft broadcast. Sending stays a manual action inside beehiiv. */
export async function createBroadcastDraft(post: BlogPost, html: string) {
  if (!beehiivConfigured()) throw new Error("beehiiv is not configured");
  return beehiiv<{ data?: { id: string } }>("/broadcasts", {
    method: "POST",
    body: JSON.stringify({
      subject: post.title,
      preview_text: post.dek,
      body_content: html,
      status: "draft",
    }),
  });
}
