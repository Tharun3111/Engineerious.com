import { describe, expect, it } from "vitest";

import {
  curatedAiCurationVersion,
  curatedAiSourceVersion,
  type CuratedAiSourceVersionInput,
} from "@/lib/curated-ai-source-version";

const source: CuratedAiSourceVersionInput = {
  id: 17,
  type: "news",
  title: "Raw title",
  url: "https://example.com/release",
  summary: "Raw summary",
  aiNote: "Ingestion note",
  source: "Example Engineering",
  sourceSlug: "example-engineering",
  sourceWeight: 1,
  author: "Source Author",
  publishedAt: new Date("2026-08-25T11:00:00.000Z"),
  firstSeen: new Date("2026-08-25T11:05:00.000Z"),
};

describe("curated AI source review version", () => {
  it("is deterministic across equivalent timestamp representations", () => {
    const equivalent = {
      ...source,
      publishedAt: "2026-08-25T11:00:00.000Z",
      firstSeen: "2026-08-25T11:05:00.000Z",
    };
    expect(curatedAiSourceVersion(equivalent)).toBe(curatedAiSourceVersion(source));
    expect(curatedAiSourceVersion(source)).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    ["id", 18],
    ["type", "model"],
    ["title", "Changed title"],
    ["url", "https://example.com/changed"],
    ["summary", "Changed summary"],
    ["aiNote", "Changed note"],
    ["source", "Changed Source"],
    ["sourceSlug", "changed-source"],
    ["sourceWeight", 2],
    ["author", null],
    ["publishedAt", "2026-08-25T12:00:00.000Z"],
    ["firstSeen", "2026-08-25T12:05:00.000Z"],
  ] satisfies Array<[keyof CuratedAiSourceVersionInput, CuratedAiSourceVersionInput[keyof CuratedAiSourceVersionInput]]>)(
    "changes when reviewed input %s changes",
    (key, value) => {
      expect(curatedAiSourceVersion({ ...source, [key]: value })).not.toBe(
        curatedAiSourceVersion(source),
      );
    },
  );
});

describe("curated AI publication version", () => {
  const published = {
    curatedSnapshot: { schemaVersion: 1, title: "Reviewed revision" },
    curatedAt: new Date("2026-08-25T14:00:00.000Z"),
    curatedBy: "Tharun Chowdary Malepati",
  };

  it("is deterministic and changes with every publication field", () => {
    expect(
      curatedAiCurationVersion({
        ...published,
        curatedAt: "2026-08-25T14:00:00.000Z",
      }),
    ).toBe(curatedAiCurationVersion(published));
    expect(curatedAiCurationVersion(published)).toMatch(/^[a-f0-9]{64}$/);
    expect(
      curatedAiCurationVersion({
        ...published,
        curatedSnapshot: { schemaVersion: 1, title: "New reviewed revision" },
      }),
    ).not.toBe(curatedAiCurationVersion(published));
    expect(
      curatedAiCurationVersion({ ...published, curatedBy: "Another reviewer" }),
    ).not.toBe(curatedAiCurationVersion(published));
  });
});
