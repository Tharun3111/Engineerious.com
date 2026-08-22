import { describe, expect, it } from "vitest";

import {
  assertNoFabricatedExperience,
  findFabricatedExperienceClaims,
  parseFrontmatter,
} from "@/lib/content/frontmatter";

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

describe("findFabricatedExperienceClaims", () => {
  const ai = { title: "A note", dek: "A description.", origin: "ai_generated" } as const;

  it("flags the real draft that prompted this guard", () => {
    // content/blog/45-eval-metrics-six-that-mattered.mdx, verbatim.
    const claims = findFabricatedExperienceClaims(
      { ...ai, title: "I reverse-engineered 45 eval metrics. Six of them predicted anything." },
      "The first eval suite I built for a production RAG assistant had 45 metrics in it.",
    );
    expect(claims).toHaveLength(2);
    expect(claims[0]).toContain("title:");
    expect(claims[1]).toContain("body:");
  });

  it.each([
    ["I built the cheapest possible version of that experiment"],
    ["In my experience that instinct is wrong most of the time"],
    ["What I run now: a single retrieval check per deploy"],
    ["We benchmarked it across three regions"],
    ["these numbers came from my own workload, not a measured baseline"],
  ])("flags %j in a machine draft", (body) => {
    expect(findFabricatedExperienceClaims(ai, body)).not.toHaveLength(0);
  });

  it("flags a claim hiding in the dek", () => {
    const claims = findFabricatedExperienceClaims({ ...ai, dek: "I ran it for a week." }, "Body.");
    expect(claims).toEqual(['dek: "I ran"']);
  });

  it("allows reporting, citation, and first-person opinion", () => {
    const body = [
      "OpenAI reported that its models breached Hugging Face during a safety eval.",
      "I think the harness, not the model, is the boundary that failed.",
      "Check Point found 11 vulnerabilities across six agent frameworks.",
      "Engineerious did not independently verify the company's account.",
    ].join("\n");
    expect(findFabricatedExperienceClaims(ai, body)).toEqual([]);
  });

  it("leaves human and ai_assisted authorship alone — the human owns the claim", () => {
    const body = "I built the eval harness and ran it against 60 conversations.";
    expect(findFabricatedExperienceClaims({ ...ai, origin: "human" }, body)).toEqual([]);
    expect(findFabricatedExperienceClaims({ ...ai, origin: "ai_assisted" }, body)).toEqual([]);
  });
});

describe("assertNoFabricatedExperience", () => {
  const ai = { title: "A note", dek: "A description.", origin: "ai_generated" } as const;

  it("throws naming the file and the offending claim", () => {
    expect(() => assertNoFabricatedExperience(ai, "I built it.", "bad.mdx")).toThrow(
      /bad\.mdx is origin: ai_generated but claims first-hand work — body: "I built"/,
    );
  });

  it("points at the two honest ways out", () => {
    expect(() => assertNoFabricatedExperience(ai, "I ran it.", "bad.mdx")).toThrow(
      /origin: human \/ ai_assisted/,
    );
  });

  it("stays silent on a clean machine draft", () => {
    expect(() => assertNoFabricatedExperience(ai, "The vendor reported a 52% failure rate.", "ok.mdx")).not.toThrow();
  });
});
