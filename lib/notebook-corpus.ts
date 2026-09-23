import type { BlogPost } from "@/lib/content/blog";
import { getPublishedWritingPosts } from "@/lib/content/blog";
import { curatedAiSnapshotSchema, type CuratedAiSignal } from "@/lib/curated-ai";
import { getCuratedAiCorpus } from "@/lib/curated-ai-queries";
import { publishedDailyBriefSchema } from "@/lib/daily-brief";
import { getDailyBriefArchive, type PublicDailyBrief } from "@/lib/daily-queries";
import {
  getPublishedHandbookEntries,
  isPublishedHandbookEntry,
  type HandbookEntry,
} from "@/lib/handbook";

export const NOTEBOOK_DOCUMENT_KINDS = [
  "writing",
  "daily",
  "signal",
  "concept",
  "framework",
  "model",
] as const;

export type NotebookDocumentKind = (typeof NOTEBOOK_DOCUMENT_KINDS)[number];

export type NotebookCitation = Readonly<{
  label: string;
  url: string;
  publisher?: string;
  publishedAt?: string;
  accessedAt?: string;
}>;

/**
 * Private, citation-preserving retrieval unit. It is intentionally richer than
 * the command-palette index and intentionally has no public API or chat route.
 */
export type NotebookDocument = Readonly<{
  id: string;
  kind: NotebookDocumentKind;
  href: string;
  title: string;
  /** Real publication/curation/update instant, always serialized as UTC ISO. */
  date: string;
  text: string;
  citations: readonly NotebookCitation[];
}>;

export type NotebookCorpusSources = Readonly<{
  writing: readonly BlogPost[];
  daily: readonly PublicDailyBrief[];
  signals: readonly CuratedAiSignal[];
  handbook: readonly HandbookEntry[];
}>;

export type NotebookSearchResult = Readonly<{
  document: NotebookDocument;
  score: number;
}>;

export const MAX_NOTEBOOK_SEARCH_RESULTS = 20;
const DEFAULT_NOTEBOOK_SEARCH_RESULTS = 8;
const MAX_QUERY_CHARACTERS = 240;
const MAX_QUERY_TERMS = 16;

function asIsoDate(value: Date | string): string | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function cleanLabel(value: string, fallback: string): string {
  const cleaned = value.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

function dedupeCitations(citations: readonly NotebookCitation[]): NotebookCitation[] {
  const seen = new Set<string>();
  const result: NotebookCitation[] = [];

  for (const citation of citations) {
    const url = citation.url.trim();
    if (!isHttpUrl(url)) continue;
    const identity = new URL(url).toString();
    if (seen.has(identity)) continue;
    seen.add(identity);
    const publisher = citation.publisher?.replace(/\s+/g, " ").trim();
    const publishedAt = citation.publishedAt
      ? asIsoDate(citation.publishedAt)
      : null;
    const accessedAt = citation.accessedAt ? asIsoDate(citation.accessedAt) : null;
    result.push(
      Object.freeze({
        label: cleanLabel(citation.label, new URL(url).hostname),
        url,
        ...(publisher ? { publisher } : {}),
        ...(publishedAt ? { publishedAt } : {}),
        ...(accessedAt ? { accessedAt } : {}),
      }),
    );
  }

  return result;
}

/** Extract only deliberate Markdown/autolink citations, not URL-looking code. */
export function extractWritingCitations(
  body: string,
  canonical?: string,
): NotebookCitation[] {
  const citations: NotebookCitation[] = [];
  const markdownLink = /!?\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+["'][^"']*["'])?\)/gi;
  for (const match of body.matchAll(markdownLink)) {
    citations.push({ label: match[1], url: match[2] });
  }

  const autoLink = /<(https?:\/\/[^>\s]+)>/gi;
  for (const match of body.matchAll(autoLink)) {
    if (isHttpUrl(match[1])) {
      citations.push({ label: new URL(match[1]).hostname, url: match[1] });
    }
  }

  const referenceLink = /^\s*\[([^\]]+)\]:\s*(https?:\/\/\S+)\s*$/gim;
  for (const match of body.matchAll(referenceLink)) {
    citations.push({ label: match[1], url: match[2] });
  }

  const htmlAnchor = /<a\s+[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  for (const match of body.matchAll(htmlAnchor)) {
    citations.push({ label: match[2], url: match[1] });
  }

  if (canonical && isHttpUrl(canonical)) {
    citations.push({ label: "Canonical publication", url: canonical });
  }

  return dedupeCitations(citations);
}

function markdownToPlainText(value: string): string {
  return value
    .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<https?:\/\/[^>\s]+>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+] |\d+[.)] )/gm, "")
    .replace(/[>*_~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function joinText(values: readonly (string | null | undefined)[]): string {
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeDocument(input: NotebookDocument): NotebookDocument {
  return Object.freeze({
    ...input,
    citations: Object.freeze([...input.citations]),
  });
}

function writingDocument(post: BlogPost): NotebookDocument | null {
  const date = asIsoDate(post.date);
  if (
    !date ||
    post.draft ||
    post.authenticityStatus !== "verified" ||
    (post.origin !== "human" && post.origin !== "ai_assisted") ||
    !post.reviewedBy?.trim() ||
    !post.reviewedAt ||
    !asIsoDate(post.reviewedAt)
  ) {
    return null;
  }

  return makeDocument({
    id: `writing:${post.slug}`,
    kind: "writing",
    href: `/blog/${post.slug}`,
    title: post.title,
    date,
    text: joinText([
      post.title,
      post.dek,
      markdownToPlainText(post.body),
      ...post.tags,
      ...post.teaches,
    ]),
    citations: extractWritingCitations(post.body, post.canonical),
  });
}

function dailyCitations(entry: PublicDailyBrief): NotebookCitation[] {
  const { brief } = entry;
  return dedupeCitations([
    ...brief.stories.flatMap((story) =>
      story.sourceUrls.map((url) => ({ label: story.sourceLabel, url })),
    ),
    ...(brief.oneThingToLearn?.sourceUrls.map((url) => ({
      label: brief.oneThingToLearn?.title ?? "One thing to learn",
      url,
    })) ?? []),
    ...(brief.modelToKnow?.sourceUrls.map((url) => ({
      label: brief.modelToKnow?.name ?? "Model to know",
      url,
    })) ?? []),
    ...(brief.toolOfTheDay?.sourceUrls.map((url) => ({
      label: brief.toolOfTheDay?.name ?? "Tool of the day",
      url,
    })) ?? []),
    ...(brief.paperWorthKnowing?.sourceUrls.map((url) => ({
      label: brief.paperWorthKnowing?.title ?? "Paper worth knowing",
      url,
    })) ?? []),
  ]);
}

function dailyDocument(entry: PublicDailyBrief): NotebookDocument | null {
  const parsed = publishedDailyBriefSchema.safeParse(entry.brief);
  const date = asIsoDate(entry.publishedAt);
  if (!parsed.success || parsed.data.date !== entry.date || !date) return null;
  const brief = parsed.data;

  return makeDocument({
    id: `daily:${entry.date}`,
    kind: "daily",
    href: `/daily/${entry.date}`,
    title: brief.title,
    date,
    text: joinText([
      brief.title,
      brief.summary,
      ...brief.stories.flatMap((story) => [
        story.headline,
        story.whatHappened,
        story.whyItMatters,
        story.forEngineers,
        story.sourceLabel,
      ]),
      brief.oneThingToLearn?.title,
      brief.oneThingToLearn?.explanation,
      brief.modelToKnow?.name,
      brief.modelToKnow?.whatItDoes,
      brief.modelToKnow?.whyInteresting,
      brief.toolOfTheDay?.name,
      brief.toolOfTheDay?.whatItIs,
      brief.toolOfTheDay?.whenToUse,
      brief.paperWorthKnowing?.title,
      brief.paperWorthKnowing?.takeaway,
      brief.myTake,
    ]),
    citations: dailyCitations(entry),
  });
}

function signalDocument(signal: CuratedAiSignal): NotebookDocument | null {
  const parsed = curatedAiSnapshotSchema.safeParse({
    schemaVersion: signal.schemaVersion,
    itemId: signal.itemId,
    type: signal.type,
    title: signal.title,
    url: signal.url,
    summary: signal.summary,
    category: signal.category,
    topicSlugs: signal.topicSlugs,
    whyItMatters: signal.whyItMatters,
    source: signal.source,
    sourceSlug: signal.sourceSlug,
    sourceWeight: signal.sourceWeight,
    author: signal.author,
    sourcePublishedAt: signal.sourcePublishedAt,
    firstSeen: signal.firstSeen,
  });
  const date = asIsoDate(signal.curatedAt);
  if (
    !parsed.success ||
    !date ||
    !signal.curatedBy.trim() ||
    !Number.isFinite(signal.rankScore)
  ) {
    return null;
  }

  return makeDocument({
    id: `signal:${signal.itemId}`,
    kind: "signal",
    href: `/ai?signal=${signal.itemId}#signal-${signal.itemId}`,
    title: signal.title,
    date,
    text: joinText([
      signal.title,
      signal.summary,
      signal.whyItMatters,
      signal.source,
      signal.author,
      signal.category,
      ...signal.topicSlugs,
    ]),
    citations: dedupeCitations([
      {
        label: signal.title,
        publisher: signal.source,
        url: signal.url,
        ...(signal.sourcePublishedAt
          ? { publishedAt: signal.sourcePublishedAt }
          : {}),
      },
    ]),
  });
}

function handbookDocument(entry: HandbookEntry): NotebookDocument | null {
  const date = asIsoDate(entry.updatedAt);
  if (
    !isPublishedHandbookEntry(entry) ||
    !date ||
    entry.sources.some(
      (source) =>
        !source.label.trim() ||
        !source.publisher.trim() ||
        !isHttpUrl(source.url) ||
        !asIsoDate(source.accessedAt) ||
        (source.publishedAt !== undefined && !asIsoDate(source.publishedAt)),
    )
  ) {
    return null;
  }

  return makeDocument({
    id: `${entry.kind}:${entry.slug}`,
    kind: entry.kind,
    href: `/ai/${entry.routeKind}/${entry.slug}`,
    title: entry.title,
    date,
    text: joinText([
      entry.title,
      entry.summary,
      markdownToPlainText(entry.body),
      entry.myTake,
      ...entry.tags,
      ...entry.topicSlugs,
    ]),
    citations: dedupeCitations(
      entry.sources.map((source) => ({
        label: source.label,
        publisher: source.publisher,
        url: source.url,
        ...(source.publishedAt ? { publishedAt: asIsoDate(source.publishedAt)! } : {}),
        accessedAt: asIsoDate(source.accessedAt)!,
      })),
    ),
  });
}

/**
 * Pure public projection. Defensive checks are repeated here so a future caller
 * cannot accidentally pass draft-like records around the canonical loaders.
 */
export function buildNotebookCorpus(sources: NotebookCorpusSources): NotebookDocument[] {
  const candidates = [
    ...sources.writing.map(writingDocument),
    ...sources.daily.map(dailyDocument),
    ...sources.signals.map(signalDocument),
    ...sources.handbook.map(handbookDocument),
  ].filter((document): document is NotebookDocument => document !== null);

  const seen = new Set<string>();
  return candidates
    .filter((document) => {
      if (seen.has(document.id)) return false;
      seen.add(document.id);
      return true;
    })
    .sort((left, right) => {
      const byDate = Date.parse(right.date) - Date.parse(left.date);
      return byDate || left.kind.localeCompare(right.kind) || left.href.localeCompare(right.href);
    });
}

async function settle<T>(
  source: string,
  load: () => T | Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[notebook-corpus] ${source} unavailable: ${message}`);
    return fallback;
  }
}

/**
 * Loads each already-public source independently. If one store is unavailable,
 * it contributes zero documents; no draft, raw-ingestion, or mutable fallback is
 * ever queried. This remains a server-side foundation, not a reader-facing API.
 */
export async function getPublicNotebookCorpus(): Promise<NotebookDocument[]> {
  const [writing, dailyResult, signalResult, handbook] = await Promise.all([
    settle("Writing", () => getPublishedWritingPosts(), []),
    settle("Daily", () => getDailyBriefArchive(100), { briefs: [], error: null }),
    settle("AI signals", () => getCuratedAiCorpus(), { signals: [], error: null }),
    settle("Handbook", () => getPublishedHandbookEntries(), []),
  ]);

  if (dailyResult.error) {
    console.error(`[notebook-corpus] Daily validation issue: ${dailyResult.error}`);
  }
  if (signalResult.error) {
    console.error(`[notebook-corpus] AI signal validation issue: ${signalResult.error}`);
  }

  return buildNotebookCorpus({
    writing,
    daily: dailyResult.briefs,
    signals: signalResult.signals,
    handbook,
  });
}

function normalizeLexicalText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function queryTerms(query: string): string[] {
  const normalized = normalizeLexicalText(query.slice(0, MAX_QUERY_CHARACTERS));
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const term of normalized.split(" ")) {
    if (!term || seen.has(term)) continue;
    seen.add(term);
    terms.push(term);
    if (terms.length >= MAX_QUERY_TERMS) break;
  }
  return terms;
}

function containsLexicalPhrase(haystack: string, phrase: string): boolean {
  return ` ${haystack} `.includes(` ${phrase} `);
}

function boundedOccurrences(haystack: string, needle: string, maximum: number): number {
  let count = 0;
  for (const token of haystack.split(" ")) {
    if (token !== needle) continue;
    count += 1;
    if (count >= maximum) break;
  }
  return count;
}

/** Deterministic, bounded lexical retrieval for a future cited notebook UI. */
export function searchNotebookCorpus(
  documents: readonly NotebookDocument[],
  query: string,
  limit = DEFAULT_NOTEBOOK_SEARCH_RESULTS,
): NotebookSearchResult[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  const normalizedQuery = terms.join(" ");
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.trunc(limit), 1), MAX_NOTEBOOK_SEARCH_RESULTS)
    : DEFAULT_NOTEBOOK_SEARCH_RESULTS;

  return documents
    .map((document) => {
      const title = normalizeLexicalText(document.title);
      const text = normalizeLexicalText(document.text);
      const citationText = normalizeLexicalText(
        document.citations.map((citation) => `${citation.label} ${citation.url}`).join(" "),
      );
      let score = title === normalizedQuery ? 1_000 : 0;
      if (containsLexicalPhrase(title, normalizedQuery)) score += 180;
      if (containsLexicalPhrase(text, normalizedQuery)) score += 45;

      let matchedTerms = 0;
      for (const term of terms) {
        const titleMatches = boundedOccurrences(title, term, 3);
        const textMatches = boundedOccurrences(text, term, 8);
        const citationMatches = boundedOccurrences(citationText, term, 3);
        if (titleMatches + textMatches + citationMatches === 0) continue;
        matchedTerms += 1;
        score += titleMatches * 28 + textMatches * 3 + citationMatches * 4;
      }

      if (matchedTerms === terms.length) score += terms.length * 12;
      return score > 0 ? Object.freeze({ document, score }) : null;
    })
    .filter((result): result is NotebookSearchResult => result !== null)
    .sort((left, right) => {
      const byScore = right.score - left.score;
      const byDate = Date.parse(right.document.date) - Date.parse(left.document.date);
      return byScore || byDate || left.document.href.localeCompare(right.document.href);
    })
    .slice(0, safeLimit);
}
