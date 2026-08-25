/**
 * Author-controlled topic registry for the public AI desk.
 *
 * Topic membership is deliberately explicit: writing must carry one of the exact
 * normalized aliases below, and a curated signal must store the topic slug in its
 * immutable snapshot. Titles and summaries are never keyword-matched into a hub.
 */
export const TOPIC_SLUGS = ["rag", "agents", "mcp"] as const;

export type TopicSlug = (typeof TOPIC_SLUGS)[number];

export type TopicDefinition = Readonly<{
  slug: TopicSlug;
  label: string;
  description: string;
  tagAliases: readonly string[];
  /** Explicit editorial picks only. An empty list is an honest empty state. */
  startHereSlugs: readonly string[];
}>;

export const topics: readonly TopicDefinition[] = [
  {
    slug: "rag",
    label: "RAG",
    description:
      "Retrieval-augmented generation, from ingestion and retrieval through reranking and evaluation.",
    tagAliases: ["rag", "retrieval augmented generation", "retrieval-augmented generation"],
    startHereSlugs: [],
  },
  {
    slug: "agents",
    label: "Agents",
    description:
      "Tool-using systems, orchestration, memory, evaluation, and failure handling.",
    tagAliases: ["agents", "ai agents", "agentic systems"],
    startHereSlugs: [],
  },
  {
    slug: "mcp",
    label: "MCP",
    description:
      "Model Context Protocol integrations, tool boundaries, transport, and production operations.",
    tagAliases: ["mcp", "model context protocol"],
    startHereSlugs: [],
  },
] as const;

export type TopicWriting = Readonly<{
  slug: string;
  tags: readonly string[];
  draft: boolean;
  authenticityStatus: "pending" | "verified";
  origin: "human" | "ai_assisted" | "ai_generated";
  date: Date;
}>;

export type TopicSignal = Readonly<{
  topicSlugs: readonly TopicSlug[];
  curatedAt: string | Date;
}>;

export type TopicActivity<
  Writing extends TopicWriting = TopicWriting,
  Signal extends TopicSignal = TopicSignal,
> = Readonly<{
  topic: TopicDefinition;
  writing: readonly Writing[];
  signals: readonly Signal[];
  active: boolean;
  latestActivityAt: Date | null;
}>;

/** Case and incidental surrounding/internal whitespace are not editorial meaning. */
export function normalizeTopicTag(tag: string): string {
  return tag.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export function getTopic(slug: string): TopicDefinition | undefined {
  return topics.find((topic) => topic.slug === slug);
}

export function matchesTopicTag(topic: TopicDefinition, tag: string): boolean {
  const normalized = normalizeTopicTag(tag);
  return topic.tagAliases.some((alias) => normalizeTopicTag(alias) === normalized);
}

function isVerifiedPublishedWriting(post: TopicWriting): boolean {
  return (
    !post.draft &&
    post.authenticityStatus === "verified" &&
    (post.origin === "human" || post.origin === "ai_assisted")
  );
}

export function getMatchingTopicWriting<Writing extends TopicWriting>(
  posts: readonly Writing[],
  topic: TopicDefinition | TopicSlug,
): Writing[] {
  const definition = typeof topic === "string" ? getTopic(topic) : topic;
  if (!definition) return [];

  return posts.filter(
    (post) =>
      isVerifiedPublishedWriting(post) &&
      post.tags.some((tag) => matchesTopicTag(definition, tag)),
  );
}

function validDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestDate(values: readonly (Date | string)[]): Date | null {
  let latest: Date | null = null;
  for (const value of values) {
    const date = validDate(value);
    if (date && (!latest || date.getTime() > latest.getTime())) latest = date;
  }
  return latest;
}

/**
 * A hub earns a public route from evidence, not a placeholder description:
 * one verified Writing post OR three immutable reviewed signals.
 */
export function buildTopicActivity<
  Writing extends TopicWriting,
  Signal extends TopicSignal,
>(
  topic: TopicDefinition,
  posts: readonly Writing[],
  signals: readonly Signal[],
): TopicActivity<Writing, Signal> {
  const writing = getMatchingTopicWriting(posts, topic);
  const matchingSignals = signals.filter((signal) =>
    signal.topicSlugs.includes(topic.slug),
  );
  const latestActivityAt = latestDate([
    ...writing.map((post) => post.date),
    ...matchingSignals.map((signal) => signal.curatedAt),
  ]);

  return {
    topic,
    writing,
    signals: matchingSignals,
    active: writing.length >= 1 || matchingSignals.length >= 3,
    latestActivityAt,
  };
}

export function getActiveTopics<
  Writing extends TopicWriting,
  Signal extends TopicSignal,
>(posts: readonly Writing[], signals: readonly Signal[]): TopicActivity<Writing, Signal>[] {
  return topics
    .map((topic) => buildTopicActivity(topic, posts, signals))
    .filter((activity) => activity.active);
}

export function hasUsefulAiContent<
  Writing extends TopicWriting,
  Signal extends TopicSignal,
>(posts: readonly Writing[], signals: readonly Signal[]): boolean {
  return signals.length > 0 || getActiveTopics(posts, signals).length > 0;
}

/** Latest real publication/curation instant for /ai sitemap metadata. */
export function latestAiActivityAt<
  Writing extends TopicWriting,
  Signal extends TopicSignal,
>(posts: readonly Writing[], signals: readonly Signal[]): Date | null {
  const activeWritingDates = getActiveTopics(posts, signals).flatMap((activity) =>
    activity.writing.map((post) => post.date),
  );
  return latestDate([
    ...signals.map((signal) => signal.curatedAt),
    ...activeWritingDates,
  ]);
}
