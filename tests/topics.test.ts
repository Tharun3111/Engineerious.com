import { describe, expect, it } from "vitest";

import {
  TOPIC_SLUGS,
  buildTopicActivity,
  getActiveTopics,
  getMatchingTopicWriting,
  getTopic,
  hasUsefulAiContent,
  latestAiActivityAt,
  normalizeTopicTag,
  topics,
  type TopicSignal,
  type TopicSlug,
  type TopicWriting,
} from "@/lib/topics";

function writing(overrides: Partial<TopicWriting> = {}): TopicWriting {
  return {
    slug: "retrieval-note",
    tags: ["rag"],
    draft: false,
    authenticityStatus: "verified",
    origin: "human",
    date: new Date("2026-08-20T12:00:00.000Z"),
    ...overrides,
  };
}

function signal(
  topicSlugs: readonly TopicSlug[],
  curatedAt = "2026-08-21T12:00:00.000Z",
): TopicSignal {
  return { topicSlugs, curatedAt };
}

describe("topic registry", () => {
  it("contains exactly the three intentional, uniquely named hubs", () => {
    expect(TOPIC_SLUGS).toEqual(["rag", "agents", "mcp"]);
    expect(topics.map((topic) => topic.slug)).toEqual(TOPIC_SLUGS);
    expect(new Set(topics.map((topic) => topic.slug)).size).toBe(topics.length);
    expect(topics.every((topic) => topic.description.length > 20)).toBe(true);
    expect(topics.every((topic) => topic.startHereSlugs.length === 0)).toBe(true);
  });

  it("normalizes only case and whitespace, then requires an exact author alias", () => {
    expect(normalizeTopicTag("  Model   Context Protocol ")).toBe(
      "model context protocol",
    );
    expect(getMatchingTopicWriting([writing({ tags: [" RAG "] })], "rag")).toHaveLength(1);
    expect(getMatchingTopicWriting([writing({ tags: ["rag evaluation"] })], "rag")).toEqual([]);
    expect(getMatchingTopicWriting([writing({ tags: ["retrieval"] })], "rag")).toEqual([]);
  });

  it("does not activate a topic for drafts, unverified work, or generated Daily posts", () => {
    const rag = getTopic("rag")!;
    const posts = [
      writing({ slug: "draft", draft: true }),
      writing({ slug: "pending", authenticityStatus: "pending" }),
      writing({ slug: "daily", origin: "ai_generated" }),
    ];
    expect(buildTopicActivity(rag, posts, []).active).toBe(false);
  });

  it("activates for one verified Writing post with an exact alias", () => {
    const rag = getTopic("rag")!;
    const activity = buildTopicActivity(rag, [writing()], []);
    expect(activity.active).toBe(true);
    expect(activity.writing.map((post) => post.slug)).toEqual(["retrieval-note"]);
  });

  it("requires three explicitly tagged curated signals and never guesses from text", () => {
    const agents = getTopic("agents")!;
    expect(buildTopicActivity(agents, [], [signal(["agents"]), signal(["agents"])]).active).toBe(
      false,
    );
    expect(
      buildTopicActivity(agents, [], [
        signal(["agents"]),
        signal(["agents"]),
        signal(["agents"]),
      ]).active,
    ).toBe(true);
    expect(
      buildTopicActivity(agents, [], [
        signal([], "2026-08-21T12:00:00.000Z"),
        signal(["rag"]),
        signal(["mcp"]),
      ]).active,
    ).toBe(false);
  });

  it("returns only active hubs and their latest real activity timestamps", () => {
    const signals = [
      signal(["mcp"], "2026-08-22T12:00:00.000Z"),
      signal(["mcp"], "2026-08-23T12:00:00.000Z"),
      signal(["mcp"], "2026-08-24T12:00:00.000Z"),
      signal([], "2026-08-25T12:00:00.000Z"),
    ];
    const active = getActiveTopics([writing()], signals);
    expect(active.map((activity) => activity.topic.slug)).toEqual(["rag", "mcp"]);
    expect(active[1].latestActivityAt?.toISOString()).toBe("2026-08-24T12:00:00.000Z");
    expect(hasUsefulAiContent([], [signal([])])).toBe(true);
    expect(latestAiActivityAt([writing()], signals)?.toISOString()).toBe(
      "2026-08-25T12:00:00.000Z",
    );
  });
});
