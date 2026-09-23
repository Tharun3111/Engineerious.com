import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { factualContentHash, myTakeContentHash } from "@/lib/daily-brief";
import {
  buildDailyPublishStatement,
  resolveDailyPublishTerminal,
} from "@/lib/daily-publish";
import { makeDailyBrief } from "@/tests/daily-fixtures";

const brief = makeDailyBrief();
const expected = {
  expectedVersion: 3,
  expectedContentHash: factualContentHash(brief),
  expectedMyTakeHash: myTakeContentHash(brief.myTake),
};

function publicationSql(): string {
  const statement = buildDailyPublishStatement({
    id: 42,
    ...expected,
    reviewerName: "Tharun",
    now: new Date("2026-08-25T16:00:00.000Z"),
  });
  return new PgDialect({ casing: "snake_case" })
    .sqlToQuery(statement)
    .sql.replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

describe("Daily publication concurrency", () => {
  it("locks the exact reviewed revision before copying its snapshot", () => {
    const query = publicationSql();
    expect(query).toContain("with eligible as materialized");
    expect(query).toMatch(/my_take_confirmed_by is not null for update/);
    expect(query).toContain("daily_published = eligible.daily_draft");
  });

  it("rechecks status, version, both hashes, and confirmation after the lock", () => {
    const query = publicationSql();
    expect(query).toMatch(/digests\.status = 'pending_review'/);
    expect(query).toMatch(/digests\.draft_version = \$\d+/);
    expect(query).toMatch(/digests\.reviewed_content_hash = \$\d+/);
    expect(query).toMatch(/digests\.my_take_confirmed_hash = \$\d+/);
    expect(query).toMatch(/digests\.my_take_confirmed_at is not null/);
  });

  it("treats only the identical published snapshot as an idempotent retry", () => {
    const terminal = {
      status: "published",
      draftVersion: 3,
      dailyPublished: brief,
      reviewedContentHash: expected.expectedContentHash,
      myTakeConfirmedHash: expected.expectedMyTakeHash,
    };
    expect(resolveDailyPublishTerminal(terminal, expected).outcome).toBe("idempotent");

    const tampered = makeDailyBrief({ title: "Changed after the request" });
    expect(
      resolveDailyPublishTerminal({ ...terminal, dailyPublished: tampered }, expected),
    ).toEqual({ outcome: "conflict", reason: "already_published_different_revision" });
  });

  it("preserves rejection and reports stale edits as terminal conflicts", () => {
    const base = {
      draftVersion: 3,
      dailyPublished: null,
      reviewedContentHash: expected.expectedContentHash,
      myTakeConfirmedHash: expected.expectedMyTakeHash,
    };
    expect(resolveDailyPublishTerminal({ ...base, status: "rejected" }, expected)).toEqual({
      outcome: "rejected",
    });
    expect(
      resolveDailyPublishTerminal({ ...base, status: "pending_review", draftVersion: 4 }, expected),
    ).toEqual({ outcome: "conflict", reason: "stale_version" });
  });
});
