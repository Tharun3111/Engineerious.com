import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";

import {
  HANDBOOK_REQUIRED_HEADINGS,
  assertValidHandbookBody,
  findFabricatedHandbookExperienceClaims,
  getPublishedHandbookEntries,
  handbookFrontmatterSchema,
  isPublishedHandbookEntry,
  loadPublishedHandbookEntries,
  parseHandbookEntry,
  type HandbookKind,
} from "@/lib/handbook";

const tempDirectories: string[] = [];

function conceptFrontmatter(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    kind: "concept",
    title: "A reviewed concept",
    summary: "A precise reference entry used only as a test fixture.",
    publishedAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-21T10:00:00.000Z",
    draft: false,
    origin: "human",
    sourceStatus: "primary",
    testedStatus: "tested_once",
    authenticityStatus: "verified",
    reviewedBy: "Human Reviewer",
    reviewedAt: "2026-08-21T11:00:00.000Z",
    myTake: "The important engineering judgment belongs here.",
    tags: ["retrieval"],
    topicSlugs: ["rag"],
    sources: [
      {
        label: "Primary documentation",
        publisher: "Documentation publisher",
        url: "https://docs.example.org/reference",
        publishedAt: "2026-08-01",
        accessedAt: "2026-08-21",
      },
    ],
    ...overrides,
  };
}

function modelFrontmatter(overrides: Record<string, unknown> = {}) {
  return {
    ...conceptFrontmatter(),
    kind: "model",
    modelFacts: {
      lab: "Model Lab",
      releaseDate: "2026-08-01",
      accessStatus: "public",
      openStatus: "open_weights",
      modalities: ["text"],
      api: false,
    },
    ...overrides,
  };
}

function bodyFor(kind: HandbookKind): string {
  return HANDBOOK_REQUIRED_HEADINGS[kind]
    .map((heading) => `## ${heading}\n\nA concrete, nonempty explanation for ${heading.toLowerCase()}.`)
    .join("\n\n");
}

function parseConcept(overrides: Record<string, unknown> = {}, body = bodyFor("concept")) {
  return parseHandbookEntry({
    frontmatter: conceptFrontmatter(overrides),
    body,
    kind: "concept",
    slug: "reviewed-concept",
    sourceName: "content/handbook/concepts/reviewed-concept.mdx",
  });
}

const PRIVATE_ENTRY_CASES: Array<[Record<string, unknown>, string]> = [
  [{ draft: true }, "a draft"],
  [
    { authenticityStatus: "pending", reviewedBy: undefined, reviewedAt: undefined },
    "pending review",
  ],
  [{ origin: "ai_generated" }, "AI-generated origin"],
];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) rmSync(directory, { recursive: true });
});

describe("handbook frontmatter and publication", () => {
  it("parses every trust field and narrows a reviewed public entry", () => {
    const entry = parseConcept();
    expect(entry.routeKind).toBe("concepts");
    expect(entry.sourceStatus).toBe("primary");
    expect(entry.testedStatus).toBe("tested_once");
    expect(entry.topicSlugs).toEqual(["rag"]);
    expect(entry.reviewedAt).toBeInstanceOf(Date);
    expect(isPublishedHandbookEntry(entry)).toBe(true);
  });

  it.each(PRIVATE_ENTRY_CASES)(
    "keeps %s private when it is %s",
    (overrides, description) => {
      expect(description.length).toBeGreaterThan(0);
      expect(isPublishedHandbookEntry(parseConcept(overrides))).toBe(false);
    },
  );

  it("requires a human identity and a review after the latest edit", () => {
    expect(() => parseConcept({ reviewedBy: undefined })).toThrow(/reviewedBy/);
    expect(() =>
      parseConcept({ reviewedAt: "2026-08-20T11:00:00.000Z" }),
    ).toThrow(/reviewedAt: The final review/);
  });

  it("requires a nonempty My Take and at least one http(s) source", () => {
    expect(() => parseConcept({ myTake: " " })).toThrow(/myTake/);
    expect(() => parseConcept({ sources: [] })).toThrow(/sources/);
    expect(() =>
      parseConcept({
        sources: [
          {
            label: "Private file",
            publisher: "Local",
            url: "file:///tmp/source.txt",
            accessedAt: "2026-08-21",
          },
        ],
      }),
    ).toThrow(/http\(s\)/);
  });

  it("accepts only valid ISO dates and sources available before review", () => {
    expect(() => parseConcept({ updatedAt: null })).toThrow(/updatedAt/);
    expect(() => parseConcept({ updatedAt: "next Thursday" })).toThrow(/ISO 8601/);
    expect(() => parseConcept({ reviewedAt: "2026-08-21" })).toThrow(/timestamp with a timezone/);
    expect(() =>
      parseConcept({
        sources: [
          {
            label: "Future source",
            publisher: "Publisher",
            url: "https://docs.example.org/future",
            publishedAt: "2026-08-22",
            accessedAt: "2026-08-21",
          },
        ],
      }),
    ).toThrow(/accessed before it was published/);
    expect(() =>
      parseConcept({
        sources: [
          {
            label: "Late source",
            publisher: "Publisher",
            url: "https://docs.example.org/late",
            accessedAt: "2026-08-22",
          },
        ],
      }),
    ).toThrow(/no later than the final review/);
  });

  it("rejects duplicate provenance, duplicate topics, and unknown keys", () => {
    const source = conceptFrontmatter().sources as Array<Record<string, unknown>>;
    expect(() => parseConcept({ sources: [source[0], source[0]] })).toThrow(
      /source URL may appear only once/,
    );
    expect(() => parseConcept({ topicSlugs: ["rag", "rag"] })).toThrow(
      /Topic slugs must be unique/,
    );
    expect(
      handbookFrontmatterSchema.safeParse({ ...conceptFrontmatter(), unsupported: true }).success,
    ).toBe(false);
  });

  it("uses the central topic registry rather than accepting inferred slugs", () => {
    expect(() => parseConcept({ topicSlugs: ["retrieval"] })).toThrow(/topicSlugs/);
  });

  it("requires model facts only for model entries and retains explicit false values", () => {
    const model = parseHandbookEntry({
      frontmatter: modelFrontmatter(),
      body: bodyFor("model"),
      kind: "model",
      slug: "reviewed-model",
      sourceName: "content/handbook/models/reviewed-model.mdx",
    });
    expect(model.modelFacts?.openStatus).toBe("open_weights");
    expect(model.modelFacts?.api).toBe(false);

    const withoutFacts = { ...conceptFrontmatter(), kind: "model" };
    expect(() =>
      parseHandbookEntry({
        frontmatter: withoutFacts,
        body: bodyFor("model"),
        kind: "model",
        slug: "missing-facts",
        sourceName: "missing-facts.mdx",
      }),
    ).toThrow(/modelFacts record/);
    expect(() => parseConcept({ modelFacts: modelFrontmatter().modelFacts })).toThrow(
      /reserved for model entries/,
    );
  });

  it("requires frontmatter kind to agree with the directory", () => {
    expect(() => parseConcept({ kind: "framework" })).toThrow(
      /directory requires "concept"/,
    );
  });

  it("rejects a noncanonical filename slug", () => {
    expect(() =>
      parseHandbookEntry({
        frontmatter: conceptFrontmatter(),
        body: bodyFor("concept"),
        kind: "concept",
        slug: "Not Canonical",
        sourceName: "bad-slug.mdx",
      }),
    ).toThrow(/lowercase kebab-case/);
  });
});

describe("kind-specific MDX structure", () => {
  it.each(["concept", "framework", "model"] as const)(
    "accepts the complete ordered %s section contract",
    (kind) => {
      expect(() => assertValidHandbookBody(kind, bodyFor(kind), `${kind}.mdx`)).not.toThrow();
    },
  );

  it("requires Architecture in the concept contract between mechanism and example", () => {
    expect(HANDBOOK_REQUIRED_HEADINGS.concept.slice(2, 5)).toEqual([
      "How it works",
      "Architecture",
      "Example",
    ]);
    expect(() =>
      assertValidHandbookBody(
        "concept",
        bodyFor("concept").replace(
          /## Architecture[^]*?(?=## Example)/,
          "",
        ),
        "concept-without-architecture.mdx",
      ),
    ).toThrow(/Architecture.*found 0/);
  });

  it("rejects a missing, duplicate, empty, or out-of-order required section", () => {
    const valid = bodyFor("model");
    expect(() =>
      assertValidHandbookBody("model", valid.replace(/## Constraints[^]*?(?=## When to use it)/, ""), "missing.mdx"),
    ).toThrow(/Constraints.*found 0/);
    expect(() =>
      assertValidHandbookBody("model", `${valid}\n\n## Capabilities\n\nAgain.`, "duplicate.mdx"),
    ).toThrow(/Capabilities.*found 2/);
    expect(() =>
      assertValidHandbookBody(
        "model",
        valid.replace("## Constraints\n\nA concrete, nonempty explanation for constraints.", "## Constraints\n\n"),
        "empty.mdx",
      ),
    ).toThrow(/Constraints.*cannot be empty/);
    const reordered = [
      "## Capabilities\n\nDetails.",
      "## What it is\n\nDefinition.",
      ...HANDBOOK_REQUIRED_HEADINGS.model.slice(2).map((heading) => `## ${heading}\n\nDetails.`),
    ].join("\n\n");
    expect(() => assertValidHandbookBody("model", reordered, "order.mdx")).toThrow(
      /required sections must follow this order/,
    );
  });

  it("reserves the page H1 and the single frontmatter-backed My Take", () => {
    expect(() =>
      assertValidHandbookBody("concept", `# Duplicate title\n\n${bodyFor("concept")}`, "h1.mdx"),
    ).toThrow(/do not add an H1/);
    expect(() =>
      assertValidHandbookBody("concept", `${bodyFor("concept")}\n\n## My Take\n\nA second take.`, "take.mdx"),
    ).toThrow(/put My Take in frontmatter/);
  });
});

describe("machine-experience integrity", () => {
  it("finds first-person work in every truth-bearing field of an AI-generated entry", () => {
    expect(
      findFabricatedHandbookExperienceClaims({
        origin: "ai_generated",
        title: "I benchmarked a model",
        summary: "We deployed it.",
        myTake: "In my experience, it works.",
        body: "I tested the fallback.",
      }),
    ).toEqual([
      'title: "I benchmarked"',
      'summary: "We deployed"',
      'myTake: "In my experience"',
      'body: "I tested"',
    ]);
  });

  it.each([
    "We've deployed the fallback.",
    "I have benchmarked three versions.",
    "What I learned from our production system.",
    "These are my results.",
  ])("catches machine anecdotes written as %j", (claim) => {
    expect(
      findFabricatedHandbookExperienceClaims({
        origin: "ai_generated",
        title: "A reference",
        summary: "A sourced summary.",
        myTake: "I think the tradeoff is acceptable.",
        body: claim,
      }),
    ).not.toEqual([]);
  });

  it("fails an AI-generated file containing fabricated experience before visibility checks", () => {
    expect(() =>
      parseConcept(
        { origin: "ai_generated", draft: true, authenticityStatus: "pending", reviewedBy: undefined, reviewedAt: undefined },
        bodyFor("concept").replace(
          "A concrete, nonempty explanation for example.",
          "I tested this in production.",
        ),
      ),
    ).toThrow(/cannot claim first-person experience/);
  });

  it("allows first-person opinion and signed human ownership", () => {
    expect(
      findFabricatedHandbookExperienceClaims({
        origin: "ai_generated",
        title: "A reference",
        summary: "A sourced summary.",
        myTake: "I think the tradeoff is acceptable.",
        body: bodyFor("concept"),
      }),
    ).toEqual([]);
    expect(() =>
      parseConcept(
        { origin: "ai_assisted" },
        bodyFor("concept").replace(
          "A concrete, nonempty explanation for example.",
          "I tested the example and take responsibility for this reviewed account.",
        ),
      ),
    ).not.toThrow();
  });
});

describe("public-only handbook loader", () => {
  it("publishes only reviewed entries and ignores inert examples", () => {
    const root = mkdtempSync(join(tmpdir(), "engineerious-handbook-"));
    tempDirectories.push(root);
    mkdirSync(join(root, "concepts"), { recursive: true });

    writeFileSync(
      join(root, "concepts", "public-entry.mdx"),
      matter.stringify(bodyFor("concept"), conceptFrontmatter({ title: "Public entry" })),
    );
    writeFileSync(
      join(root, "concepts", "private-entry.mdx"),
      matter.stringify(bodyFor("concept"), conceptFrontmatter({ title: "Private entry", draft: true })),
    );
    writeFileSync(join(root, "concepts", "ignored.mdx.example"), "not valid frontmatter");

    const entries = loadPublishedHandbookEntries(root);
    expect(entries.map((entry) => entry.slug)).toEqual(["public-entry"]);
    expect(entries[0].reviewedBy).toBe("Human Reviewer");
  });

  it("does not silently hide a malformed actual MDX file", () => {
    const root = mkdtempSync(join(tmpdir(), "engineerious-handbook-"));
    tempDirectories.push(root);
    mkdirSync(join(root, "concepts"), { recursive: true });
    writeFileSync(join(root, "concepts", "broken.mdx"), "No frontmatter.");
    expect(() => loadPublishedHandbookEntries(root)).toThrow(/Invalid handbook frontmatter/);
  });

  it("ships with no invented handbook entry", () => {
    expect(getPublishedHandbookEntries()).toEqual([]);
  });
});
