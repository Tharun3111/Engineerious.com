import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  parsePublicDailyRow,
  publicDailyRobots,
  publicDailyVisibilityPredicate,
  type PublicDailyRow,
} from "@/lib/daily-queries";
import { makeDailyBrief } from "@/tests/daily-fixtures";

function row(overrides: Partial<PublicDailyRow> = {}): PublicDailyRow {
  return {
    digestId: 42,
    date: "2026-08-25",
    status: "published",
    publishedAt: new Date("2026-08-25T16:00:00.000Z"),
    dailyPublished: makeDailyBrief(),
    ...overrides,
  };
}

describe("public Daily visibility", () => {
  it("queries only terminal snapshots, never the private draft", () => {
    const compiled = new PgDialect({ casing: "snake_case" }).sqlToQuery(
      sql`select * from digests where ${publicDailyVisibilityPredicate()}`,
    );
    const query = compiled.sql.replace(/\s+/g, " ").toLowerCase();
    expect(query).toMatch(/"digests"\."status" = \$\d+/);
    expect(compiled.params).toContain("published");
    expect(query).toContain('"digests"."daily_published" is not null');
    expect(query).toContain('"digests"."published_at" is not null');
    expect(query).not.toContain("daily_draft");
  });

  it("accepts only a valid published snapshot", () => {
    expect(parsePublicDailyRow(row())?.brief.title).toContain("reviewed day");
    expect(parsePublicDailyRow(row({ status: "pending_review" }))).toBeNull();
    expect(parsePublicDailyRow(row({ publishedAt: null }))).toBeNull();
  });

  it("fails closed on malformed or incomplete public JSON", () => {
    expect(parsePublicDailyRow(row({ dailyPublished: { title: "private fragment" } }))).toBeNull();
    expect(
      parsePublicDailyRow(row({ dailyPublished: makeDailyBrief({ myTake: "" }) })),
    ).toBeNull();
  });

  it("fails closed when the snapshot date disagrees with its digest", () => {
    expect(parsePublicDailyRow(row({ date: "2026-08-24" }))).toBeNull();
    expect(parsePublicDailyRow(row({ publishedAt: "not-a-date" }))).toBeNull();
  });

  it("keeps an empty archive out of search until a snapshot is public", () => {
    expect(publicDailyRobots(false)).toEqual({ index: false, follow: true });
    expect(publicDailyRobots(true)).toEqual({ index: true, follow: true });
  });
});
