import { describe, expect, it } from "vitest";

import { parseFrontmatter } from "@/lib/content/frontmatter";

const base = {
  title: "A useful note",
  dek: "A specific description.",
  pillar: "eval-first",
  date: "2026-08-10",
  format: "article",
  origin: "ai_generated",
  sourceStatus: "mixed",
  testedStatus: "not_tested",
  authenticityStatus: "pending",
};

describe("parseFrontmatter", () => {
  it("accepts pending drafts without truth-bearing review defaults", () => {
    const parsed = parseFrontmatter(base, "pending.mdx");
    expect(parsed.draft).toBe(false);
    expect(parsed.tags).toEqual([]);
    expect(parsed.authenticityStatus).toBe("pending");
  });

  it("accepts verified content with reviewer and timestamp", () => {
    const parsed = parseFrontmatter(
      {
        ...base,
        authenticityStatus: "verified",
        origin: "human",
        sourceStatus: "primary",
        testedStatus: "tested_once",
        reviewedBy: "Tharun Chowdary",
        reviewedAt: "2026-08-10T12:00:00Z",
      },
      "verified.mdx",
    );
    expect(parsed.reviewedAt).toBeInstanceOf(Date);
  });

  it("rejects verified content without reviewer evidence", () => {
    expect(() =>
      parseFrontmatter({ ...base, authenticityStatus: "verified" }, "unsafe.mdx"),
    ).toThrow(/reviewedBy.*reviewedAt/);
  });

  it("reports the source for malformed metadata", () => {
    expect(() => parseFrontmatter({ ...base, title: "" }, "broken.mdx")).toThrow(
      /Invalid frontmatter in broken\.mdx/,
    );
  });
});
