import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { buildDigestPublishStatement } from "@/lib/digest-publish";

function publicationSql(): string {
  const statement = buildDigestPublishStatement({
    id: 42,
    reviewerName: "Reviewer",
    now: new Date("2026-08-25T12:00:00Z"),
    editorialDate: new Date("2026-08-24T12:00:00Z"),
    sourceStatus: "mixed",
  });
  return new PgDialect({ casing: "snake_case" })
    .sqlToQuery(statement)
    .sql.replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

describe("digest publication concurrency", () => {
  it("locks the eligible digest before changing its post", () => {
    const query = publicationSql();
    expect(query).toContain("with eligible as materialized");
    expect(query).toMatch(/blog_post_slug is not null for update \), published_post as/);
  });

  it("rechecks publishable status on the final digest update", () => {
    const query = publicationSql();
    expect(query).toMatch(
      /where digests\.id = published_post\.digest_id and digests\.status in \('pending_review', 'approved'\)/,
    );
  });

  it("repairs legacy source labels inside the same atomic publication", () => {
    expect(publicationSql()).toMatch(/source_status = \$\d+/);
  });
});
