/**
 * Author-controlled topic registry for the public AI desk.
 *
 * Topic membership is deliberately explicit: writing must carry one of the exact
 * normalized aliases below, while curated signals and published handbook entries
 * must store the topic slug in reviewed content. Titles and summaries are never
 * keyword-matched into a hub.
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

/**
 * Structural public-handbook contract. This deliberately lives here instead of
 * importing `lib/handbook`: the handbook schema imports `TOPIC_SLUGS`, and a
 * reverse runtime import would turn the editorial registry into a cycle.
 */
export type TopicHandbook = Readonly<{
  slug: string;
  routeKind: "concepts" | "frameworks" | "models";
  topicSlugs: readonly TopicSlug[];
  draft: boolean;
  authenticityStatus: "pending" | "verified";
  origin: "human" | "ai_assisted" | "ai_generated";
  publishedAt: Date;
  updatedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  sources: readonly unknown[];
  myTake: string;
}>;

export type TopicActivity<
  Writing extends TopicWriting = TopicWriting,
  Signal extends TopicSignal = TopicSignal,
  Handbook extends TopicHandbook = TopicHandbook,
> = Readonly<{
  topic: TopicDefinition;
  writing: readonly Writing[];
  signals: readonly Signal[];
  handbook: readonly Handbook[];
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

function isVerifiedPublishedHandbook(entry: TopicHandbook): boolean {
  return (
    !entry.draft &&
    entry.authenticityStatus === "verified" &&
    (entry.origin === "human" || entry.origin === "ai_assisted") &&
    validDate(entry.publishedAt) !== null &&
    validDate(entry.updatedAt) !== null &&
    Boolean(entry.reviewedBy?.trim()) &&
    entry.reviewedAt instanceof Date &&
    Number.isFinite(entry.reviewedAt.getTime()) &&
    entry.sources.length > 0 &&
    entry.myTake.trim().length > 0
  );
}

export function getMatchingTopicHandbook<Handbook extends TopicHandbook>(
  entries: readonly Handbook[],
  topic: TopicDefinition | TopicSlug,
): Handbook[] {
  const definition = typeof topic === "string" ? getTopic(topic) : topic;
  if (!definition) return [];

  return entries.filter(
    (entry) =>
      isVerifiedPublishedHandbook(entry) && entry.topicSlugs.includes(definition.slug),
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
 * one verified Writing post, one published handbook entry, or three immutable
 * reviewed signals.
 */
export function buildTopicActivity<
  Writing extends TopicWriting,
  Signal extends TopicSignal,
  Handbook extends TopicHandbook = TopicHandbook,
>(
  topic: TopicDefinition,
  posts: readonly Writing[],
  signals: readonly Signal[],
  handbookEntries: readonly Handbook[] = [],
): TopicActivity<Writing, Signal, Handbook> {
  const writing = getMatchingTopicWriting(posts, topic);
  const matchingSignals = signals.filter((signal) =>
    signal.topicSlugs.includes(topic.slug),
  );
  const handbook = getMatchingTopicHandbook(handbookEntries, topic);
  const latestActivityAt = latestDate([
    ...writing.map((post) => post.date),
    ...matchingSignals.map((signal) => signal.curatedAt),
    ...handbook.map((entry) => entry.updatedAt),
  ]);

  return {
    topic,
    writing,
    signals: matchingSignals,
    handbook,
    active: writing.length >= 1 || handbook.length >= 1 || matchingSignals.length >= 3,
    latestActivityAt,
  };
}

export function getActiveTopics<
  Writing extends TopicWriting,
  Signal extends TopicSignal,
  Handbook extends TopicHandbook = TopicHandbook,
>(
  posts: readonly Writing[],
  signals: readonly Signal[],
  handbookEntries: readonly Handbook[] = [],
): TopicActivity<Writing, Signal, Handbook>[] {
  return topics
    .map((topic) => buildTopicActivity(topic, posts, signals, handbookEntries))
    .filter((activity) => activity.active);
}

export function hasUsefulAiContent<
  Writing extends TopicWriting,
  Signal extends TopicSignal,
  Handbook extends TopicHandbook = TopicHandbook,
>(
  posts: readonly Writing[],
  signals: readonly Signal[],
  handbookEntries: readonly Handbook[] = [],
): boolean {
  return (
    signals.length > 0 ||
    handbookEntries.some(isVerifiedPublishedHandbook) ||
    getActiveTopics(posts, signals, handbookEntries).length > 0
  );
}

/** Latest real publication/curation instant for /ai sitemap metadata. */
export function latestAiActivityAt<
  Writing extends TopicWriting,
  Signal extends TopicSignal,
  Handbook extends TopicHandbook = TopicHandbook,
>(
  posts: readonly Writing[],
  signals: readonly Signal[],
  handbookEntries: readonly Handbook[] = [],
): Date | null {
  const activeTopics = getActiveTopics(posts, signals, handbookEntries);
  const activeWritingDates = activeTopics.flatMap((activity) =>
    activity.writing.map((post) => post.date),
  );
  const handbookDates = handbookEntries
    .filter(isVerifiedPublishedHandbook)
    .map((entry) => entry.updatedAt);
  return latestDate([
    ...signals.map((signal) => signal.curatedAt),
    ...activeWritingDates,
    ...handbookDates,
  ]);
}
