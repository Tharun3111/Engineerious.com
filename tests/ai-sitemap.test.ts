import { describe, expect, it } from "vitest";

import { aiDeskRobots } from "@/app/ai/page";
import { buildAiSitemapEntries, buildHandbookSitemapEntries } from "@/app/sitemap";
import { topicPageRobots } from "@/app/topics/[slug]/page";
import type { HandbookEntry, PublishedHandbookEntry } from "@/lib/handbook";
import type { TopicSignal, TopicSlug, TopicWriting } from "@/lib/topics";

function writing(
  tag = "rag",
  date = "2026-08-20T12:00:00.000Z",
): TopicWriting {
  return {
    slug: "reviewed-writing",
    tags: [tag],
    draft: false,
    authenticityStatus: "verified",
    origin: "human",
    date: new Date(date),
  };
}

function signal(
  topicSlugs: readonly TopicSlug[],
  curatedAt: string,
): TopicSignal {
  return { topicSlugs, curatedAt };
}

function handbook(
  overrides: Partial<PublishedHandbookEntry> = {},
): PublishedHandbookEntry {
  return {
    schemaVersion: 1,
    kind: "concept",
    routeKind: "concepts",
    slug: "hybrid-search",
    title: "Hybrid search",
    summary: "A reviewed retrieval reference.",
    body: "## Definition\n\nA grounded explanation.",
    myTake: "Use both channels only when each closes a measured gap.",
    tags: ["retrieval"],
    topicSlugs: [],
    sources: [
      {
        label: "Primary docs",
        publisher: "Example Lab",
        url: "https://example.com/search",
        accessedAt: new Date("2026-08-24T09:00:00.000Z"),
      },
    ],
    sourceStatus: "primary",
    testedStatus: "tested_once",
    draft: false,
    authenticityStatus: "verified",
    origin: "human",
    publishedAt: new Date("2026-08-20T10:00:00.000Z"),
    updatedAt: new Date("2026-08-24T10:00:00.000Z"),
    reviewedBy: "Tharun",
    reviewedAt: new Date("2026-08-24T11:00:00.000Z"),
    readingMinutes: 4,
    ...overrides,
  };
}

describe("AI and topic sitemap entries", () => {
  const site = "https://engineerious.com";

  it("omits the AI desk and all thin topic hubs when nothing useful is public", () => {
    expect(buildAiSitemapEntries(site, [], [])).toEqual([]);
  });

  it("includes /ai for one reviewed signal without opening an underfilled topic", () => {
    const curatedAt = "2026-08-25T15:30:00.000Z";
    const entries = buildAiSitemapEntries(site, [], [signal(["agents"], curatedAt)]);

    expect(entries.map((entry) => entry.url)).toEqual([`${site}/ai`]);
    expect(entries[0].lastModified).toEqual(new Date(curatedAt));
  });

  it("opens a topic for one verified matching Writing entry using its real date", () => {
    const post = writing(" Model   Context Protocol ", "2026-08-24T09:00:00.000Z");
    const entries = buildAiSitemapEntries(site, [post], []);

    expect(entries.map((entry) => entry.url)).toEqual([`${site}/ai`, `${site}/topics/mcp`]);
    expect(entries[0].lastModified).toEqual(post.date);
    expect(entries[1].lastModified).toEqual(post.date);
  });

  it("opens only explicitly tagged signal hubs at the three-signal threshold", () => {
    const signals = [
      signal(["agents"], "2026-08-22T12:00:00.000Z"),
      signal(["agents"], "2026-08-23T12:00:00.000Z"),
      signal(["agents"], "2026-08-24T12:00:00.000Z"),
      signal(["rag"], "2026-08-25T12:00:00.000Z"),
    ];
    const entries = buildAiSitemapEntries(site, [], signals);

    expect(entries.map((entry) => entry.url)).toEqual([
      `${site}/ai`,
      `${site}/topics/agents`,
    ]);
    expect(entries[0].lastModified).toEqual(new Date("2026-08-25T12:00:00.000Z"));
    expect(entries[1].lastModified).toEqual(new Date("2026-08-24T12:00:00.000Z"));
  });

  it("keeps a low-ranked topic active beyond the top-100 display boundary", () => {
    const higherUnrelated = Array.from({ length: 100 }, (_, index) =>
      signal([], new Date(Date.UTC(2026, 7, 20, 0, index)).toISOString()),
    );
    const lowRankedTopic = [
      signal(["agents"], "2026-08-25T10:01:00.000Z"),
      signal(["agents"], "2026-08-25T10:02:00.000Z"),
      signal(["agents"], "2026-08-25T10:03:00.000Z"),
    ];

    const entries = buildAiSitemapEntries(site, [], [
      ...higherUnrelated,
      ...lowRankedTopic,
    ]);

    expect(entries.map((entry) => entry.url)).toContain(`${site}/topics/agents`);
    expect(entries.find((entry) => entry.url.endsWith("/topics/agents"))?.lastModified).toEqual(
      new Date("2026-08-25T10:03:00.000Z"),
    );
  });

  it("includes an untagged published handbook entry and uses its real update date", () => {
    const entry = handbook({
      updatedAt: new Date("2026-08-27T10:00:00.000Z"),
      reviewedAt: new Date("2026-08-27T11:00:00.000Z"),
    });
    const entries = buildAiSitemapEntries(site, [], [], [entry]);

    expect(entries.map((item) => item.url)).toEqual([
      `${site}/ai`,
      `${site}/ai/concepts/hybrid-search`,
    ]);
    expect(entries[0].lastModified).toEqual(entry.updatedAt);
    expect(entries[1].lastModified).toEqual(entry.updatedAt);
  });

  it("uses explicit handbook topic membership and keeps model notes under /ai/models", () => {
    const tagged = handbook({ topicSlugs: ["rag"] });
    const model = handbook({
      kind: "model",
      routeKind: "models",
      slug: "example-model",
      title: "Example model",
      topicSlugs: [],
      modelFacts: {
        lab: "Example Lab",
        releaseDate: new Date("2026-08-01T00:00:00.000Z"),
        accessStatus: "public",
        openStatus: "open_weights",
      },
    });
    const entries = buildAiSitemapEntries(site, [], [], [tagged, model]);

    expect(entries.map((item) => item.url)).toEqual([
      `${site}/ai`,
      `${site}/topics/rag`,
      `${site}/ai/concepts/hybrid-search`,
      `${site}/ai/models/example-model`,
    ]);
    expect(entries.some((item) => item.url === `${site}/models/example-model`)).toBe(false);
  });

  it("filters draft-like entries out of handbook sitemap helpers", () => {
    const published = handbook();
    const draft: HandbookEntry = { ...published, draft: true };

    expect(buildHandbookSitemapEntries(site, [draft, published]).map((item) => item.url)).toEqual([
      `${site}/ai/concepts/hybrid-search`,
    ]);
  });
});

describe("conditional indexing policy", () => {
  it("noindexes an empty AI desk and inactive topic", () => {
    expect(aiDeskRobots(false)).toEqual({ index: false, follow: true });
    expect(topicPageRobots(false)).toEqual({ index: false, follow: false });
  });

  it("indexes only useful desk and active topic states", () => {
    expect(aiDeskRobots(true)).toEqual({ index: true, follow: true });
    expect(topicPageRobots(true)).toEqual({ index: true, follow: true });
  });
});
