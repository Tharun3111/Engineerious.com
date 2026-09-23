import { createHash } from "node:crypto";

import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import type { NewsletterStatus } from "@/db/schema";
import {
  parsePublishedDailyBrief,
  type PublishedDailyBrief,
} from "@/lib/daily-brief";
import { httpUrlSchema } from "@/lib/editorial-safety";
import type { ResendBroadcastStatus } from "@/lib/resend";
import { noActiveUnsyncedSubscribersPredicate } from "@/lib/subscriber-queries";

export const NEWSLETTER_UNSUBSCRIBE_TAG = "{{{RESEND_UNSUBSCRIBE_URL}}}";
export const newsletterSubjectSchema = z
  .string()
  .transform((value) => value.normalize("NFKC").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1, "Subject is required.")
      .max(200, "Subject must be 200 characters or fewer.")
      .refine(
        (value) => !value.includes("{{") && !value.includes("}}"),
        "Subject must not contain provider template delimiters.",
      ),
  );

const idSchema = z.number().int().positive();
const versionSchema = z.number().int().nonnegative();

export type NewsletterActionRequest =
  | { id: number; action: "prepare"; expectedVersion: number }
  | { id: number; action: "save"; expectedVersion: number; subject: string }
  | { id: number; action: "approve"; expectedVersion: number }
  | { id: number; action: "reopen"; expectedVersion: number }
  | { id: number; action: "send"; expectedVersion: number }
  | { id: number; action: "reconcile"; expectedVersion: number };

export const newsletterActionSchema: z.ZodType<NewsletterActionRequest> = z.discriminatedUnion(
  "action",
  [
    z.object({ id: idSchema, action: z.literal("prepare"), expectedVersion: versionSchema }).strict(),
    z
      .object({
        id: idSchema,
        action: z.literal("save"),
        expectedVersion: versionSchema,
        subject: newsletterSubjectSchema,
      })
      .strict(),
    z.object({ id: idSchema, action: z.literal("approve"), expectedVersion: versionSchema }).strict(),
    z.object({ id: idSchema, action: z.literal("reopen"), expectedVersion: versionSchema }).strict(),
    z.object({ id: idSchema, action: z.literal("send"), expectedVersion: versionSchema }).strict(),
    z.object({ id: idSchema, action: z.literal("reconcile"), expectedVersion: versionSchema }).strict(),
  ],
);

export type NewsletterActionResult = {
  ok: true;
  id: number;
  status: NewsletterStatus;
  newsletterVersion: number;
  subject?: string;
  broadcastId?: string;
  idempotent?: boolean;
};

export type NewsletterArtifact = {
  subject: string;
  html: string;
  approvalHash: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    // Resend expands double/triple-brace provider templates after accepting the
    // Broadcast HTML. Encode braces in every dynamic value so reviewed content,
    // URLs, and configuration cannot introduce a recipient-data merge token.
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;");
}

function normalizeSiteUrl(value: string): string {
  const url = httpUrlSchema.parse(value.trim());
  return url.replace(/\/$/, "");
}

function sourceLinks(urls: readonly string[]): string {
  return urls
    .map((url, index) => {
      const safeUrl = httpUrlSchema.parse(url);
      let label = `Source ${index + 1}`;
      try {
        label = new URL(safeUrl).hostname.replace(/^www\./, "");
      } catch {
        // The schema already validated this URL. The numbered label is a safe fallback.
      }
      return `<a href="${escapeHtml(safeUrl)}" style="color:#1262e8;text-decoration:underline;">${escapeHtml(label)}</a>`;
    })
    .join(" · ");
}

function sectionRow(input: {
  label: string;
  title: string;
  body: string;
  urls: readonly string[];
}): string {
  return `<tr><td style="padding:20px 0;border-top:1px solid #d9dfeb;">
  <p style="margin:0 0 6px;font-size:11px;line-height:1.4;letter-spacing:.09em;text-transform:uppercase;color:#247a52;font-weight:700;">${escapeHtml(input.label)}</p>
  <h2 style="margin:0 0 8px;font-size:18px;line-height:1.35;color:#101a2e;">${escapeHtml(input.title)}</h2>
  <p style="margin:0 0 9px;font-size:14px;line-height:1.65;color:#465166;">${escapeHtml(input.body)}</p>
  <p style="margin:0;font-size:12px;line-height:1.5;">${sourceLinks(input.urls)}</p>
</td></tr>`;
}

export function defaultNewsletterSubject(brief: PublishedDailyBrief): string {
  const parsed = parsePublishedDailyBrief(brief);
  const prefix = `Engineerious Daily · ${parsed.date} · `;
  const available = Math.max(1, 200 - prefix.length);
  return newsletterSubjectSchema.parse(`${prefix}${parsed.title.slice(0, available)}`);
}

/** Render only from the immutable, schema-validated public Daily snapshot. */
export function renderNewsletterEmail(input: {
  brief: PublishedDailyBrief;
  siteUrl: string;
  postalAddress: string;
}): string {
  const brief = parsePublishedDailyBrief(input.brief);
  const siteUrl = normalizeSiteUrl(input.siteUrl);
  const postalAddress = z.string().trim().min(1).max(500).parse(input.postalAddress);
  const storyRows = brief.stories
    .map(
      (story) => `<tr><td style="padding:22px 0;border-top:1px solid #d9dfeb;">
  <p style="margin:0 0 6px;font-size:11px;line-height:1.4;letter-spacing:.09em;text-transform:uppercase;color:#247a52;font-weight:700;">${escapeHtml(story.category.replaceAll("_", " "))} · ${escapeHtml(story.sourceLabel)}</p>
  <h2 style="margin:0 0 10px;font-size:19px;line-height:1.35;color:#101a2e;">${escapeHtml(story.headline)}</h2>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#465166;"><strong style="color:#101a2e;">What happened:</strong> ${escapeHtml(story.whatHappened)}</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#465166;"><strong style="color:#101a2e;">Why it matters:</strong> ${escapeHtml(story.whyItMatters)}</p>
  <p style="margin:0 0 9px;font-size:14px;line-height:1.65;color:#465166;"><strong style="color:#101a2e;">For engineers:</strong> ${escapeHtml(story.forEngineers)}</p>
  <p style="margin:0;font-size:12px;line-height:1.5;">${sourceLinks(story.sourceUrls)}</p>
</td></tr>`,
    )
    .join("");

  const supportingRows = [
    brief.oneThingToLearn
      ? sectionRow({
          label: "One thing to learn",
          title: brief.oneThingToLearn.title,
          body: brief.oneThingToLearn.explanation,
          urls: brief.oneThingToLearn.sourceUrls,
        })
      : "",
    brief.modelToKnow
      ? sectionRow({
          label: "Model to know",
          title: brief.modelToKnow.name,
          body: `${brief.modelToKnow.whatItDoes} ${brief.modelToKnow.whyInteresting}`,
          urls: brief.modelToKnow.sourceUrls,
        })
      : "",
    brief.toolOfTheDay
      ? sectionRow({
          label: "Tool of the day",
          title: brief.toolOfTheDay.name,
          body: `${brief.toolOfTheDay.whatItIs} ${brief.toolOfTheDay.whenToUse}`,
          urls: brief.toolOfTheDay.sourceUrls,
        })
      : "",
    brief.paperWorthKnowing
      ? sectionRow({
          label: "Paper worth knowing",
          title: brief.paperWorthKnowing.title,
          body: brief.paperWorthKnowing.takeaway,
          urls: brief.paperWorthKnowing.sourceUrls,
        })
      : "",
  ].join("");

  const postalHtml = escapeHtml(postalAddress.replace(/\r\n?/g, "\n")).replaceAll("\n", "<br>");
  const dailyUrl = `${siteUrl}/daily/${brief.date}`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2efe7;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fffdf8;border:1px solid #d9dfeb;">
<tr><td style="padding:28px 30px 22px;border-top:5px solid #1262e8;">
  <p style="margin:0 0 8px;font-size:11px;line-height:1.4;letter-spacing:.1em;text-transform:uppercase;color:#1262e8;font-weight:700;">Engineerious Daily · ${escapeHtml(brief.date)}</p>
  <h1 style="margin:0 0 10px;font-size:25px;line-height:1.25;color:#101a2e;">${escapeHtml(brief.title)}</h1>
  <p style="margin:0;font-size:15px;line-height:1.65;color:#465166;">${escapeHtml(brief.summary)}</p>
</td></tr>
<tr><td style="padding:0 30px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${storyRows}${supportingRows}
<tr><td style="padding:22px 0;border-top:1px solid #d9dfeb;">
  <p style="margin:0 0 6px;font-size:11px;line-height:1.4;letter-spacing:.09em;text-transform:uppercase;color:#1262e8;font-weight:700;">Tharun's take</p>
  <p style="margin:0;font-size:15px;line-height:1.7;color:#101a2e;">${escapeHtml(brief.myTake)}</p>
</td></tr>
</table></td></tr>
<tr><td style="padding:5px 30px 28px;"><a href="${escapeHtml(dailyUrl)}" style="display:inline-block;background:#101a2e;color:#fff;text-decoration:none;padding:11px 16px;font-size:13px;font-weight:700;">Read the web edition →</a></td></tr>
<tr><td style="padding:20px 30px 26px;border-top:1px solid #d9dfeb;color:#667085;font-size:11px;line-height:1.65;">
  Engineerious · ${postalHtml}<br>
  You received this because you subscribed to Engineerious. <a href="${NEWSLETTER_UNSUBSCRIBE_TAG}" style="color:#667085;text-decoration:underline;">Unsubscribe</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

export function newsletterApprovalHash(input: { subject: string; html: string }): string {
  const subject = newsletterSubjectSchema.parse(input.subject);
  const firstTag = input.html.indexOf(NEWSLETTER_UNSUBSCRIBE_TAG);
  const htmlWithoutFixedTag = input.html.replace(NEWSLETTER_UNSUBSCRIBE_TAG, "");
  if (
    firstTag < 0 ||
    firstTag !== input.html.lastIndexOf(NEWSLETTER_UNSUBSCRIBE_TAG) ||
    htmlWithoutFixedTag.includes("{{") ||
    htmlWithoutFixedTag.includes("}}")
  ) {
    throw new Error(
      "Newsletter HTML must contain exactly one unsubscribe merge tag and no other provider templates.",
    );
  }
  return createHash("sha256")
    .update(JSON.stringify({ schemaVersion: 1, subject, html: input.html }), "utf8")
    .digest("hex");
}

export function prepareNewsletterArtifact(input: {
  brief: PublishedDailyBrief;
  siteUrl: string;
  postalAddress: string;
  subject?: string;
}): NewsletterArtifact {
  const subject = newsletterSubjectSchema.parse(input.subject ?? defaultNewsletterSubject(input.brief));
  const html = renderNewsletterEmail(input);
  return { subject, html, approvalHash: newsletterApprovalHash({ subject, html }) };
}

export type NewsletterSendClaim = {
  id: number;
  newsletterSubject: string;
  emailHtml: string;
  newsletterApprovedHash: string;
  newsletterBroadcastId: string | null;
  newsletterVersion: number;
};

export const newsletterSendClaimSchema: z.ZodType<NewsletterSendClaim> = z
  .object({
    id: idSchema,
    newsletterSubject: newsletterSubjectSchema,
    emailHtml: z.string().min(1),
    newsletterApprovedHash: z.string().regex(/^[a-f0-9]{64}$/),
    newsletterBroadcastId: z.string().trim().min(1).max(256).nullable(),
    newsletterVersion: versionSchema,
  })
  .strict();

/**
 * One-statement local send claim. The final predicates are rechecked after a lock
 * wait, and the same statement refuses to claim while any active contact is unsynced.
 */
export function buildNewsletterSendClaimStatement(input: {
  id: number;
  expectedVersion: number;
  expectedApprovedHash: string;
  now: Date;
}): SQL {
  return sql`
    with eligible as materialized (
      select id,
             newsletter_subject,
             email_html,
             newsletter_approved_hash,
             newsletter_broadcast_id,
             newsletter_version
        from digests
       where id = ${input.id}
         and status = 'published'
         and daily_published is not null
         and newsletter_status = 'approved'
         and newsletter_version = ${input.expectedVersion}
         and newsletter_subject is not null
         and email_html is not null
         and newsletter_approved_hash = ${input.expectedApprovedHash}
         and ${noActiveUnsyncedSubscribersPredicate}
       for update
    )
    update digests
       set newsletter_status = 'sending',
           newsletter_claimed_at = ${input.now},
           newsletter_error = null,
           newsletter_version = digests.newsletter_version + 1,
           updated_at = ${input.now}
      from eligible
     where digests.id = eligible.id
       and digests.status = 'published'
       and digests.newsletter_status = 'approved'
       and digests.newsletter_version = ${input.expectedVersion}
       and digests.newsletter_subject = eligible.newsletter_subject
       and digests.email_html = eligible.email_html
       and digests.newsletter_approved_hash = ${input.expectedApprovedHash}
       and ${noActiveUnsyncedSubscribersPredicate}
    returning digests.id as "id",
              eligible.newsletter_subject as "newsletterSubject",
              eligible.email_html as "emailHtml",
              eligible.newsletter_approved_hash as "newsletterApprovedHash",
              eligible.newsletter_broadcast_id as "newsletterBroadcastId",
              digests.newsletter_version as "newsletterVersion"
  `;
}

export function providerStatusToNewsletterStatus(
  status: ResendBroadcastStatus,
): "approved" | "queued" | "sent" | "canceled" {
  switch (status) {
    case "draft":
      return "approved";
    case "scheduled":
    case "queued":
      return "queued";
    case "sent":
      return "sent";
    case "canceled":
      return "canceled";
  }
}

export function isNewsletterArtifactCurrent(input: {
  brief: PublishedDailyBrief;
  siteUrl: string;
  postalAddress: string;
  subject: string | null;
  html: string | null;
  approvedHash: string | null;
}): boolean {
  if (!input.subject || !input.html || !input.approvedHash) return false;
  const expected = prepareNewsletterArtifact({
    brief: input.brief,
    siteUrl: input.siteUrl,
    postalAddress: input.postalAddress,
    subject: input.subject,
  });
  return expected.html === input.html && expected.approvalHash === input.approvedHash;
}
