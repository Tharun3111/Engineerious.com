import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

function migration(): string {
  const name = readdirSync("db/migrations").find((file) => file.startsWith("0009_") && file.endsWith(".sql"));
  if (!name) throw new Error("Newsletter migration 0009 is missing.");
  return readFileSync(`db/migrations/${name}`, "utf8").toLowerCase();
}

describe("legacy subscriber canonicalization migration", () => {
  it("fails explicitly when one canonical address maps to different provider contacts", () => {
    const sql = migration();
    expect(sql).toContain('count(distinct "resend_contact_id")');
    expect(sql).toContain("one email maps to multiple resend contact ids");
  });

  it("merges before deletion and canonical backfill, then enables the database check", () => {
    const sql = migration();
    const merge = sql.indexOf('update "subscribers" as "subscriber"');
    const dedupe = sql.indexOf('delete from "subscribers" as "subscriber"');
    const canonicalize = sql.indexOf('update "subscribers" set "email" = lower(btrim("email"))');
    const constraint = sql.indexOf('add constraint "subscribers_email_canonical_check"');

    expect(sql).toContain('min("subscribed_at")');
    expect(sql).toContain('max("resend_contact_id")');
    expect(sql).toContain('order by "subscribed_at" desc, "id" desc');
    expect(merge).toBeGreaterThan(-1);
    expect(dedupe).toBeGreaterThan(merge);
    expect(canonicalize).toBeGreaterThan(dedupe);
    expect(constraint).toBeGreaterThan(canonicalize);
  });

  it("keeps schema, migration, and the existing exact conflict target aligned", () => {
    const schema = readFileSync("db/schema.ts", "utf8");
    expect(schema).toContain('uniqueIndex("subscribers_email_key").on(t.email)');
    expect(schema).toContain('check("subscribers_email_canonical_check"');
    expect(schema).not.toContain("welcomeEmail");
    expect(migration()).not.toContain("welcome_email");
  });
});
