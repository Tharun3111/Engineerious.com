import { env } from "@/lib/env";

/**
 * Resend — newsletter delivery. Replaces beehiiv as the sender: beehiiv's Send API
 * (the only way to trigger an actual send, not just a draft) is gated behind their
 * Max plan (~$96/mo billed annually) regardless of subscriber count, which fails
 * "cheapest as best" outright. Resend's free tier covers unlimited broadcast sends
 * to up to 1,000 contacts at $0/mo.
 *
 * Uses Resend's current Segments API, not the deprecated Audiences API — Resend's
 * SDK source (2026) explicitly states `audienceId` "cannot be used together with
 * segments or topics" on contact creation, and broadcasts target a segment. One
 * Segment is created once (in the Resend dashboard) and its id stored as
 * RESEND_SEGMENT_ID — every subscriber is added to it, every broadcast sends to it.
 *
 * The raw REST API's field casing is NOT uniform across endpoints — confirmed live,
 * not assumed from the SDK: /contacts accepts camelCase `segments`, /broadcasts
 * requires snake_case `segment_id` (the SDK's own `segmentId` TS field name does not
 * match the wire format it sends). See sendDigest() below.
 */

const API = "https://api.resend.com";

export function resendConfigured(): boolean {
  return Boolean(env.resendApiKey && env.resendSegmentId && env.resendFromAddress);
}

async function resend<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.resendApiKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Resend ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/**
 * Adds (or updates) a contact in the newsletter segment. Called after the Postgres
 * `subscribers` row is already written — a failure here must not be treated as the
 * subscribe request failing, since the email is already captured in our own DB.
 */
export async function upsertContact(email: string): Promise<string> {
  if (!resendConfigured()) throw new Error("Resend is not configured");
  const body = await resend<{ id: string }>("/contacts", {
    method: "POST",
    body: JSON.stringify({
      email,
      unsubscribed: false,
      // Each entry is { id }, not a bare string — confirmed against Resend's SDK
      // source (contacts/interfaces/create-contact-options.interface.ts); the API
      // rejects a plain string array with 422 "expected object, received string".
      segments: [{ id: env.resendSegmentId }],
    }),
  });
  return body.id;
}

/**
 * Transactional send (Resend's `/emails` endpoint), NOT a broadcast — fires
 * immediately per-subscriber, doesn't need a verified-domain broadcast send and
 * isn't rate-limited the way segment broadcasts are. This is the confirmation a
 * new subscriber currently never gets: upsertContact() only adds them to the
 * segment silently, with no signal back to them that anything happened.
 */
export async function sendWelcomeEmail(email: string): Promise<void> {
  if (!resendConfigured()) return;
  const site = env.siteUrl.replace(/\/$/, "");
  await resend("/emails", {
    method: "POST",
    body: JSON.stringify({
      from: env.resendFromAddress,
      to: email,
      subject: "You're on the list — Engineerious",
      html: `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <p style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#0a5fa5;font-weight:700;">Engineerious</p>
        <h1 style="font-size:20px;color:#0d1b24;">You're subscribed.</h1>
        <p style="color:#555;font-size:15px;line-height:1.6;">
          You'll get source-checked AI engineering analysis when there's real work to share —
          no automated link dumps, no daily filler.
        </p>
        <p style="margin-top:24px;">
          <a href="${site}/blog" style="color:#0a5fa5;font-weight:600;">Read the blog →</a>
        </p>
        <p style="color:#999;font-size:12px;margin-top:32px;">
          <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#999;">Unsubscribe</a>
        </p>
      </div>`,
    }),
  });
}

export type SendDigestInput = {
  subject: string;
  html: string;
};

/**
 * Create-and-send in one call (`send: true`) — this is what makes "approve in
 * /admin" and "email goes out" the same action with no separate manual step.
 *
 * `html` MUST include the `{{{RESEND_UNSUBSCRIBE_URL}}}` merge tag somewhere visible
 * (CAN-SPAM requires a working unsubscribe link) — Resend renders it into a real,
 * working link and updates the contact's unsubscribed status when clicked. Omitting
 * it renders an empty string, silently breaking compliance.
 */
export async function sendDigest({ subject, html }: SendDigestInput): Promise<{ id: string }> {
  if (!resendConfigured()) throw new Error("Resend is not configured");
  return resend<{ id: string }>("/broadcasts", {
    method: "POST",
    // snake_case, confirmed live 2026-08-11 — the raw REST API uses `segment_id`,
    // NOT the `segmentId` the Node SDK's TypeScript interface uses (the SDK
    // translates casing internally before hitting the wire). Sending `segmentId`
    // here fails with 422 "Missing either `segment_id` or `audience_id` field" —
    // the API silently doesn't recognize the wrong-cased key rather than rejecting
    // it as an unknown field, which is what makes this easy to miss without a live
    // call. Contrast with upsertContact() below, whose /contacts endpoint DOES
    // accept the camelCase `segments` key — the two endpoints are inconsistent with
    // each other, not just with the SDK.
    body: JSON.stringify({
      segment_id: env.resendSegmentId,
      from: env.resendFromAddress,
      subject,
      html,
      send: true,
    }),
  });
}
