import { readFileSync } from "node:fs";

import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  buildNewsletterSendClaimStatement,
  providerStatusToNewsletterStatus,
} from "@/lib/newsletter";

function renderedClaimSql(): string {
  return new PgDialect({ casing: "snake_case" })
    .sqlToQuery(
      buildNewsletterSendClaimStatement({
        id: 7,
        expectedVersion: 4,
        expectedApprovedHash: "a".repeat(64),
        now: new Date("2026-08-25T18:00:00.000Z"),
      }),
    )
    .sql.replace(/\s+/g, " ")
    .trim();
}

function claimSql(): string {
  return renderedClaimSql().toLowerCase();
}

describe("newsletter outbox concurrency", () => {
  it("locks and rechecks the exact approved artifact before claiming one send", () => {
    const query = claimSql();
    expect(query).toContain("with eligible as materialized");
    expect(query).toMatch(/newsletter_approved_hash = \$\d+.*for update/);
    expect(query).toMatch(/digests\.newsletter_status = 'approved'/);
    expect(query).toMatch(/digests\.newsletter_version = \$\d+/);
    expect(query).toContain("digests.newsletter_subject = eligible.newsletter_subject");
    expect(query).toContain("digests.email_html = eligible.email_html");
    expect(query).toContain("newsletter_version = digests.newsletter_version + 1");
  });

  it("checks for unsynced active subscribers in both the lock and final update", () => {
    expect(claimSql().match(/not exists \(/g)).toHaveLength(2);
    expect(claimSql()).toMatch(/"subscribers"\."unsubscribed_at" is null/);
    expect(claimSql()).toMatch(/"subscribers"\."resend_contact_id" is null/);
  });

  it("aliases every raw RETURNING column to the validated camelCase claim contract", () => {
    const query = renderedClaimSql();
    expect(query).toContain('digests.id as "id"');
    expect(query).toContain('eligible.newsletter_subject as "newsletterSubject"');
    expect(query).toContain('eligible.email_html as "emailHtml"');
    expect(query).toContain('eligible.newsletter_approved_hash as "newsletterApprovedHash"');
    expect(query).toContain('eligible.newsletter_broadcast_id as "newsletterBroadcastId"');
    expect(query).toContain('digests.newsletter_version as "newsletterVersion"');
  });

  it("maps provider drafts back to approved only through reconciliation semantics", () => {
    expect(providerStatusToNewsletterStatus("draft")).toBe("approved");
    expect(providerStatusToNewsletterStatus("scheduled")).toBe("queued");
    expect(providerStatusToNewsletterStatus("queued")).toBe("queued");
    expect(providerStatusToNewsletterStatus("sent")).toBe("sent");
    expect(providerStatusToNewsletterStatus("canceled")).toBe("canceled");
  });

  it("keeps web publication and cron generation free of delivery side effects", () => {
    const files = [
      "app/api/admin/digests/route.ts",
      "app/api/cron/daily-digest/route.ts",
      "app/api/cron/daily-write/route.ts",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/@\/lib\/resend|sendBroadcast|createBroadcastDraft/);
    }
  });

  it("revalidates the Daily RSS feed when a structured brief is published", () => {
    const route = readFileSync("app/api/admin/digests/route.ts", "utf8");
    const start = route.indexOf("function revalidateDaily");
    const helper = route.slice(start, route.indexOf("async function finishDailyPublication", start));
    expect(helper).toContain('revalidatePath("/rss.xml")');
  });

  it("has one send call site and explicitly refuses to repeat a claimed send", () => {
    const route = readFileSync("app/api/admin/newsletters/route.ts", "utf8");
    const provider = readFileSync("lib/resend.ts", "utf8");
    expect(route.match(/await sendBroadcast\(/g)).toHaveLength(1);
    expect(route).toContain("has already been claimed. Reconcile it instead of retrying send");
    expect(provider).toContain("send: false");
  });
});
