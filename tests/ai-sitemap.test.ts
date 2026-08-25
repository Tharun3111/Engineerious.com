import { describe, expect, it } from "vitest";

import { aiDeskRobots } from "@/app/ai/page";
import { buildAiSitemapEntries } from "@/app/sitemap";
import { topicPageRobots } from "@/app/topics/[slug]/page";
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
