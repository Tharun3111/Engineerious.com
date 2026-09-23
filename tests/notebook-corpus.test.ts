import { describe, expect, it } from "vitest";

import type { BlogPost } from "@/lib/content/blog";
import type { CuratedAiSignal } from "@/lib/curated-ai";
import { parsePublishedDailyBrief } from "@/lib/daily-brief";
import type { PublicDailyBrief } from "@/lib/daily-queries";
import {
  HANDBOOK_REQUIRED_HEADINGS,
  parseHandbookEntry,
  type HandbookEntry,
  type HandbookKind,
} from "@/lib/handbook";
import {
  MAX_NOTEBOOK_SEARCH_RESULTS,
  buildNotebookCorpus,
  searchNotebookCorpus,
  type NotebookDocument,
} from "@/lib/notebook-corpus";
import { makeDailyBrief } from "@/tests/daily-fixtures";

function writing(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    slug: "hybrid-retrieval",
    title: "Hybrid retrieval in production",
    dek: "A reviewed field note about lexical and semantic retrieval.",
    pillar: "rag-mlops",
    date: new Date("2026-08-20T12:00:00.000Z"),
    tags: ["rag", "retrieval"],
    teaches: ["retrieval evaluation"],
    notCovered: [],
    draft: false,
    format: "field_note",
    origin: "human",
    sourceStatus: "mixed",
    testedStatus: "tested_once",
    authenticityStatus: "verified",
    reviewedBy: "Tharun",
    reviewedAt: new Date("2026-08-20T13:00:00.000Z"),
    body:
      "## Result\n\nThe measured tradeoff follows the [primary documentation](https://docs.example.com/hybrid).",
    readingMinutes: 2,
    source: "mdx",
    ...overrides,
  };
}

function daily(): PublicDailyBrief {
  const brief = parsePublishedDailyBrief(makeDailyBrief());
  return {
    digestId: 7,
    date: brief.date,
    publishedAt: new Date("2026-08-25T12:00:00.000Z"),
    brief,
  };
}

function signal(overrides: Partial<CuratedAiSignal> = {}): CuratedAiSignal {
  return {
    schemaVersion: 1,
    itemId: 42,
    type: "news",
    title: "A reviewed retrieval release",
    url: "https://example.com/release",
    summary: "The release changes a documented retrieval boundary.",
    category: "developer_tools",
    topicSlugs: ["rag"],
    whyItMatters: "Engineers need to rerun retrieval evaluations.",
    source: "Example Lab",
    sourceSlug: "example-lab",
    sourceWeight: 2,
    author: null,
    sourcePublishedAt: "2026-08-24T10:00:00.000Z",
    firstSeen: "2026-08-24T10:05:00.000Z",
    curatedAt: "2026-08-24T12:00:00.000Z",
    curatedBy: "Tharun",
    rankScore: 4,
    ...overrides,
  };
}

function handbookBody(kind: HandbookKind): string {
  return HANDBOOK_REQUIRED_HEADINGS[kind]
    .map((heading) => `## ${heading}\n\nA concrete explanation for ${heading.toLowerCase()}.`)
    .join("\n\n");
}

function handbook(overrides: Record<string, unknown> = {}): HandbookEntry {
  return parseHandbookEntry({
    kind: "concept",
    slug: "hybrid-search",
    sourceName: "content/handbook/concepts/hybrid-search.mdx",
    body: handbookBody("concept"),
    frontmatter: {
      schemaVersion: 1,
      kind: "concept",
      title: "Hybrid search",
      summary: "A reviewed reference for combining lexical and vector retrieval.",
      publishedAt: "2026-08-21T10:00:00.000Z",
      updatedAt: "2026-08-23T10:00:00.000Z",
      draft: false,
      origin: "human",
      sourceStatus: "primary",
      testedStatus: "tested_once",
      authenticityStatus: "verified",
      reviewedBy: "Tharun",
      reviewedAt: "2026-08-23T11:00:00.000Z",
      myTake: "Use both channels only when each closes a measured retrieval gap.",
      tags: ["retrieval"],
      topicSlugs: ["rag"],
      sources: [
        {
          label: "Search documentation",
          publisher: "Example Lab",
          url: "https://docs.example.com/search",
          accessedAt: "2026-08-23",
        },
      ],
      ...overrides,
    },
  });
}

function corpus(overrides: Partial<Parameters<typeof buildNotebookCorpus>[0]> = {}) {
  return buildNotebookCorpus({
    writing: [writing()],
    daily: [daily()],
    signals: [signal()],
    handbook: [handbook()],
    ...overrides,
  });
}

describe("public notebook corpus", () => {
  it("retains permanent URLs, real dates, public text, and source citations for every kind", () => {
    const documents = corpus();

    expect(documents.map((document) => document.kind).sort()).toEqual([
      "concept",
      "daily",
      "signal",
      "writing",
    ]);
    expect(documents.find((document) => document.kind === "writing")).toEqual(
      expect.objectContaining({
        href: "/blog/hybrid-retrieval",
        date: "2026-08-20T12:00:00.000Z",
        citations: [
          { label: "primary documentation", url: "https://docs.example.com/hybrid" },
        ],
      }),
    );
    expect(documents.find((document) => document.kind === "daily")?.citations).toContainEqual({
      label: "Example Research Lab",
      url: "https://example.com/announcement",
    });
    expect(documents.find((document) => document.kind === "signal")).toEqual(
      expect.objectContaining({
        href: "/ai?signal=42#signal-42",
        citations: [
          {
            label: "A reviewed retrieval release",
            publisher: "Example Lab",
            url: "https://example.com/release",
            publishedAt: "2026-08-24T10:00:00.000Z",
          },
        ],
      }),
    );
    expect(documents.find((document) => document.kind === "concept")).toEqual(
      expect.objectContaining({
        href: "/ai/concepts/hybrid-search",
        date: "2026-08-23T10:00:00.000Z",
        citations: [
          {
            label: "Search documentation",
            publisher: "Example Lab",
            url: "https://docs.example.com/search",
            accessedAt: "2026-08-23T00:00:00.000Z",
          },
        ],
      }),
    );
  });

  it("defensively excludes drafts, generated Writing, invalid snapshots, and private handbook entries", () => {
    const invalidDaily = {
      ...daily(),
      date: "2026-08-24",
    };
    const documents = corpus({
      writing: [
        writing({ slug: "draft", draft: true }),
        writing({ slug: "generated", origin: "ai_generated" }),
      ],
      daily: [invalidDaily],
      signals: [signal({ rankScore: Number.NaN })],
      handbook: [handbook({ draft: true })],
    });

    expect(documents).toEqual([]);
  });

  it("keeps the permanent page href when verified Writing has no external citation", () => {
    const [document] = corpus({
      writing: [writing({ slug: "uncited-note", body: "## Note\n\nA reviewed local explanation." })],
      daily: [],
      signals: [],
      handbook: [],
    });

    expect(document.href).toBe("/blog/uncited-note");
    expect(document.citations).toEqual([]);
  });
});

describe("notebook lexical retrieval", () => {
  it("is deterministic, relevance-ranked, bounded, and preserves the cited document", () => {
    const exact = corpus().find((document) => document.kind === "concept")!;
    const filler: NotebookDocument[] = Array.from({ length: 30 }, (_, index) => ({
      id: `writing:filler-${index}`,
      kind: "writing",
      href: `/blog/filler-${index}`,
      title: `Retrieval note ${index}`,
      date: new Date(Date.UTC(2026, 7, 1, 0, index)).toISOString(),
      text: "Hybrid retrieval appears once in this secondary note.",
      citations: [{ label: "Filler source", url: `https://example.com/${index}` }],
    }));
    const documents = [exact, ...filler];

    const first = searchNotebookCorpus(documents, "hybrid search", 999);
    const second = searchNotebookCorpus(documents, "hybrid search", 999);

    expect(first).toEqual(second);
    expect(first).toHaveLength(MAX_NOTEBOOK_SEARCH_RESULTS);
    expect(first[0].document.id).toBe("concept:hybrid-search");
    expect(first[0].document.citations).toEqual(exact.citations);
    expect(searchNotebookCorpus(documents, "   ")).toEqual([]);
  });
});
