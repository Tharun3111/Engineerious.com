export const SEARCH_ITEM_KINDS = [
  "writing",
  "daily",
  "signal",
  "topic",
  "project",
] as const;

export type SearchItemKind = (typeof SEARCH_ITEM_KINDS)[number];

/** The only shape the public search endpoint is allowed to return. */
export type SearchItem = {
  id: string;
  kind: SearchItemKind;
  href: string;
  title: string;
  description: string;
  label: string;
  keywords: string[];
};

type SearchSourceBase = {
  title: string;
  description: string;
  label: string;
  keywords: readonly string[];
};

export type SearchWritingSource = SearchSourceBase & { slug: string };
export type SearchDailySource = SearchSourceBase & { date: string };
export type SearchSignalSource = SearchSourceBase & { itemId: number };
export type SearchTopicSource = SearchSourceBase & { slug: string };
export type SearchProjectSource = SearchSourceBase & { slug: string };

export type PublicSearchSources = {
  writing: readonly SearchWritingSource[];
  daily: readonly SearchDailySource[];
  signals: readonly SearchSignalSource[];
  topics: readonly SearchTopicSource[];
  projects: readonly SearchProjectSource[];
};

function cleanKeywords(keywords: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const keyword of keywords) {
    const cleaned = keyword.trim();
    const identity = cleaned.toLocaleLowerCase("en-US");
    if (!cleaned || seen.has(identity)) continue;
    seen.add(identity);
    result.push(cleaned);
  }

  return result;
}

function item(
  kind: SearchItemKind,
  identity: string,
  href: string,
  source: SearchSourceBase,
): SearchItem {
  return {
    id: `${kind}:${identity}`,
    kind,
    href,
    title: source.title,
    description: source.description,
    label: source.label,
    keywords: cleanKeywords(source.keywords),
  };
}

/**
 * Normalizes inputs that callers have already proven public. This function does
 * not query, infer publication state, or turn a private record into a result.
 */
export function buildSearchIndex(sources: PublicSearchSources): SearchItem[] {
  const candidates = [
    ...sources.writing.map((source) =>
      item("writing", source.slug, `/blog/${source.slug}`, source),
    ),
    ...sources.daily.map((source) =>
      item("daily", source.date, `/daily/${source.date}`, source),
    ),
    ...sources.signals.map((source) =>
      item("signal", String(source.itemId), `/ai#signal-${source.itemId}`, source),
    ),
    ...sources.topics.map((source) =>
      item("topic", source.slug, `/topics/${source.slug}`, source),
    ),
    ...sources.projects.map((source) =>
      item("project", source.slug, `/projects/${source.slug}`, source),
    ),
  ];

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return true;
  });
}
