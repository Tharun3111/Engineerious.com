import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

import { items, type ItemType } from "@/db/schema";
import { TOPIC_SLUGS, type TopicSlug } from "@/lib/topics";

export const CURATED_AI_TYPES = ["news", "model", "oss"] as const;
export const CURATED_AI_CATEGORIES = [
  "models",
  "agents",
  "research",
  "open_source",
  "frameworks",
  "infrastructure",
  "business",
  "developer_tools",
  "ai_products",
  "big_tech",
] as const;
export const CURATED_AI_TOPIC_SLUGS = TOPIC_SLUGS;

export type CuratedAiCategory = (typeof CURATED_AI_CATEGORIES)[number];
export type CuratedTopicSlug = TopicSlug;

const cleanText = (label: string) =>
  z
    .string()
    .min(1, `${label} is required.`)
    .refine((value) => value === value.trim(), `${label} cannot begin or end with whitespace.`);

const httpUrlSchema = cleanText("URL")
  .url("URL must be valid.")
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "URL must use HTTP or HTTPS.");

export const curatedTopicSlugSchema = z.enum(CURATED_AI_TOPIC_SLUGS);

/** The only item payload public AI surfaces are allowed to render. */
export const curatedAiSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    itemId: z.number().int().positive(),
    type: z.enum(CURATED_AI_TYPES),
    title: cleanText("Title"),
    url: httpUrlSchema,
    summary: cleanText("Summary"),
    category: z.enum(CURATED_AI_CATEGORIES),
    topicSlugs: z
      .array(curatedTopicSlugSchema)
      .max(CURATED_AI_TOPIC_SLUGS.length)
      .superRefine((values, context) => {
        if (new Set(values).size !== values.length) {
          context.addIssue({ code: "custom", message: "Topic slugs must be unique." });
        }
      }),
    whyItMatters: cleanText("Why it matters"),
    source: cleanText("Source"),
    sourceSlug: cleanText("Source slug"),
    sourceWeight: z.number().finite().nonnegative(),
    author: cleanText("Author").nullable(),
    sourcePublishedAt: z.iso.datetime().nullable(),
    firstSeen: z.iso.datetime(),
  })
  .strict();

type ParsedCuratedAiSnapshot = z.infer<typeof curatedAiSnapshotSchema>;

export type CuratedAiSnapshot = Readonly<
  Omit<ParsedCuratedAiSnapshot, "topicSlugs"> & {
    readonly topicSlugs: readonly CuratedTopicSlug[];
  }
>;

export type CuratedAiSignal = Readonly<
  CuratedAiSnapshot & {
    curatedAt: string;
    curatedBy: string;
    /** Mutable ranking metadata; never a source of public prose or attribution. */
    rankScore: number;
  }
>;

export type CuratedAiRow = {
  itemId: number;
  type: string;
  status: string;
  score: number;
  curatedSnapshot: unknown;
  curatedAt: Date | string | null;
  curatedBy: string | null;
};

export function parseCuratedAiSnapshot(value: unknown): CuratedAiSnapshot {
  const parsed = curatedAiSnapshotSchema.parse(value);
  return Object.freeze({
    ...parsed,
    topicSlugs: Object.freeze([...parsed.topicSlugs]),
  });
}

/**
 * Fail-closed public integrity boundary. The copied payload must be valid, its
 * identity must match the approved row, and all publication metadata must exist.
 */
export function parseCuratedAiRow(row: CuratedAiRow): CuratedAiSignal | null {
  if (row.status !== "approved" || !row.curatedAt || !row.curatedBy) return null;
  if (!Number.isFinite(row.score)) return null;
  if (row.curatedBy !== row.curatedBy.trim() || row.curatedBy.length === 0) return null;

  const parsed = curatedAiSnapshotSchema.safeParse(row.curatedSnapshot);
  // Ingestion may later classify the same canonical URL under another raw type.
  // Type is reviewed snapshot content, not live ranking metadata, so a mutable
  // row.type change must never rewrite or hide an already-published signal.
  if (!parsed.success || parsed.data.itemId !== row.itemId) {
    return null;
  }

  const curatedAt = row.curatedAt instanceof Date ? row.curatedAt : new Date(row.curatedAt);
  if (Number.isNaN(curatedAt.getTime())) return null;

  return Object.freeze({
    ...parsed.data,
    topicSlugs: Object.freeze([...parsed.data.topicSlugs]),
    curatedAt: curatedAt.toISOString(),
    curatedBy: row.curatedBy,
    rankScore: row.score,
  });
}

export function allowedCuratedTypes(publicResearchEnabled: boolean): ItemType[] {
  return publicResearchEnabled ? ["news", "model", "oss"] : ["news", "model"];
}

/** Visibility is a data-layer contract, independent of the intentionally closed raw feeds. */
export function curatedAiVisibilityPredicate(publicResearchEnabled: boolean) {
  return and(
    eq(items.status, "approved"),
    inArray(
      sql<string>`${items.curatedSnapshot}->>'type'`,
      allowedCuratedTypes(publicResearchEnabled),
    ),
    isNotNull(items.curatedSnapshot),
    isNotNull(items.curatedAt),
    isNotNull(items.curatedBy),
  )!;
}
