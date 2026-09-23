import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  allowedCuratedTypes,
  curatedAiSnapshotSchema,
  curatedAiVisibilityPredicate,
  parseCuratedAiRow,
  parseCuratedAiSnapshot,
  type CuratedAiRow,
} from "@/lib/curated-ai";

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    itemId: 42,
    type: "news",
    title: "A reviewed engineering release",
    url: "https://example.com/release",
    summary: "The release changes a documented API boundary.",
    category: "infrastructure",
    topicSlugs: ["rag", "agents"],
    whyItMatters: "Teams need to retest their retrieval pipeline before migrating.",
    source: "Example Engineering",
    sourceSlug: "example-engineering",
    sourceWeight: 1.2,
    author: null,
    sourcePublishedAt: "2026-08-25T12:00:00.000Z",
    firstSeen: "2026-08-25T12:05:00.000Z",
    ...overrides,
  };
}

function row(overrides: Partial<CuratedAiRow> = {}): CuratedAiRow {
  return {
    itemId: 42,
    type: "news",
    status: "approved",
    score: 12.5,
    curatedSnapshot: snapshot(),
    curatedAt: new Date("2026-08-25T14:00:00.000Z"),
    curatedBy: "Tharun Chowdary Malepati",
    ...overrides,
  };
}

describe("curated AI snapshot", () => {
  it("accepts and freezes the exact v1 reviewed payload", () => {
    const parsed = parseCuratedAiSnapshot(snapshot());
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.topicSlugs).toEqual(["rag", "agents"]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.topicSlugs)).toBe(true);
  });

  it("is strict and rejects unsafe URLs, duplicate topics, and unsupported taxonomy", () => {
    expect(curatedAiSnapshotSchema.safeParse({ ...snapshot(), extra: true }).success).toBe(false);
    expect(curatedAiSnapshotSchema.safeParse(snapshot({ url: "javascript:alert(1)" })).success).toBe(false);
    expect(curatedAiSnapshotSchema.safeParse(snapshot({ url: "ftp://example.com/file" })).success).toBe(false);
    expect(curatedAiSnapshotSchema.safeParse(snapshot({ topicSlugs: ["rag", "rag"] })).success).toBe(false);
    expect(curatedAiSnapshotSchema.safeParse(snapshot({ topicSlugs: ["prompting"] })).success).toBe(false);
    expect(curatedAiSnapshotSchema.safeParse(snapshot({ category: "marketing" })).success).toBe(false);
  });

  it("rejects negative and non-finite source authority weights", () => {
    expect(curatedAiSnapshotSchema.safeParse(snapshot({ sourceWeight: -0.01 })).success).toBe(false);
    expect(curatedAiSnapshotSchema.safeParse(snapshot({ sourceWeight: Number.POSITIVE_INFINITY })).success).toBe(false);
    expect(curatedAiSnapshotSchema.safeParse(snapshot({ sourceWeight: Number.NaN })).success).toBe(false);
    expect(curatedAiSnapshotSchema.safeParse(snapshot({ sourceWeight: 0 })).success).toBe(true);
  });
});

describe("curated AI public integrity", () => {
  it("returns snapshot content plus reviewed metadata and finite live rank only", () => {
    const parsed = parseCuratedAiRow(row());
    expect(parsed).toMatchObject({
      itemId: 42,
      title: "A reviewed engineering release",
      curatedAt: "2026-08-25T14:00:00.000Z",
      curatedBy: "Tharun Chowdary Malepati",
      rankScore: 12.5,
    });
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it("fails closed when identity, moderation, rank, or curation metadata disagrees", () => {
    expect(parseCuratedAiRow(row({ itemId: 41 }))).toBeNull();
    expect(parseCuratedAiRow(row({ status: "pending" }))).toBeNull();
    expect(parseCuratedAiRow(row({ score: Number.NaN }))).toBeNull();
    expect(parseCuratedAiRow(row({ curatedAt: "not-a-date" }))).toBeNull();
    expect(parseCuratedAiRow(row({ curatedBy: "  " }))).toBeNull();
    expect(parseCuratedAiRow(row({ curatedSnapshot: { title: "raw leak" } }))).toBeNull();
  });

  it("keeps reviewed snapshot type visible when later ingestion reclassifies the raw row", () => {
    const parsed = parseCuratedAiRow(row({ type: "oss" }));
    expect(parsed?.type).toBe("news");
  });

  it("allows curated news and models by default, adding OSS only behind research launch", () => {
    expect(allowedCuratedTypes(false)).toEqual(["news", "model"]);
    expect(allowedCuratedTypes(true)).toEqual(["news", "model", "oss"]);

    const closed = new PgDialect({ casing: "snake_case" }).sqlToQuery(
      sql`select * from items where ${curatedAiVisibilityPredicate(false)}`,
    );
    expect(closed.params).toContain("approved");
    expect(closed.params).toContain("news");
    expect(closed.params).toContain("model");
    expect(closed.params).not.toContain("oss");
    expect(closed.sql).toContain(`"items"."curated_snapshot"->>'type'`);
    expect(closed.sql).not.toContain(`"items"."type" in`);
    expect(closed.sql).toContain('"items"."curated_snapshot" is not null');
    expect(closed.sql).toContain('"items"."curated_at" is not null');
    expect(closed.sql).toContain('"items"."curated_by" is not null');

    const open = new PgDialect({ casing: "snake_case" }).sqlToQuery(
      sql`select * from items where ${curatedAiVisibilityPredicate(true)}`,
    );
    expect(open.params).toContain("oss");
  });
});
