import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { items, type ItemType } from "@/db/schema";
import {
  curatedAiVisibilityPredicate,
  curatedTopicSlugSchema,
  parseCuratedAiRow,
  type CuratedAiSignal,
} from "@/lib/curated-ai";
import {
  curatedAiCurationVersion,
  curatedAiSourceVersion,
} from "@/lib/curated-ai-source-version";
import { getDb, shouldFailOnDatabaseError } from "@/lib/db";

export const CURATED_AI_CACHE_TAG = "curated-ai";
const CURATED_AI_CACHE_SECONDS = 300;

export type CuratedAiQueryResult = {
  signals: CuratedAiSignal[];
  error: string | null;
};

type PublicCuratedAiRow = {
  itemId: number;
  type: string;
  status: string;
  score: number;
  curatedSnapshot: unknown;
  curatedAt: Date | string | null;
  curatedBy: string | null;
};

export type CuratedAiAdminRecord = {
  id: number;
  type: ItemType;
  title: string;
  url: string;
  summary: string | null;
  aiNote: string | null;
  source: string;
  sourceSlug: string;
  score: number;
  firstSeen: string;
  publishedAt: string | null;
  /** Opaque version of every source/review input shown in this admin record. */
  expectedSourceVersion: string;
  expectedCurationVersion: string | null;
  signal: CuratedAiSignal | null;
  hasCuratedState: boolean;
  curationError: string | null;
};

export type CuratedAiAdminResult = {
  items: CuratedAiAdminRecord[];
  error: string | null;
};

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[curated-ai-queries]", message);
  return message;
}

async function queryCuratedRows(
  publicResearchEnabled: boolean,
): Promise<PublicCuratedAiRow[]> {
  return getDb()
    .select({
      itemId: items.id,
      type: items.type,
      status: items.status,
      score: items.score,
      curatedSnapshot: items.curatedSnapshot,
      curatedAt: items.curatedAt,
      curatedBy: items.curatedBy,
    })
    .from(items)
    .where(curatedAiVisibilityPredicate(publicResearchEnabled))
    // Score remains live ranking metadata (`rankScore`). Every piece of prose,
    // attribution, and source timing still comes exclusively from the snapshot.
    .orderBy(desc(items.score), desc(items.curatedAt), desc(items.id));
}

/**
 * Canonical public corpus of reviewed immutable snapshots. It is intentionally
 * not query-capped: topic thresholds and latest-activity metadata must not change
 * when an unrelated signal crosses a display-page boundary. Human curation keeps
 * this collection bounded; public HTML and search results apply their own caps.
 * Malformed snapshots fail closed while the returned error keeps corruption
 * distinguishable from a genuinely empty desk.
 */
export async function getCuratedAiCorpus({
  publicResearchEnabled = process.env.PUBLIC_RESEARCH_ENABLED === "true",
}: {
  publicResearchEnabled?: boolean;
} = {}): Promise<CuratedAiQueryResult> {
  const gate = publicResearchEnabled ? "research-open" : "research-closed";

  try {
    const rows = await unstable_cache(
      () => queryCuratedRows(publicResearchEnabled),
      ["curated-ai-corpus", gate],
      { revalidate: CURATED_AI_CACHE_SECONDS, tags: [CURATED_AI_CACHE_TAG] },
    )();

    const signals: CuratedAiSignal[] = [];
    let invalidCount = 0;
    for (const row of rows) {
      const signal = parseCuratedAiRow(row);
      if (signal) signals.push(signal);
      else invalidCount += 1;
    }

    const error =
      invalidCount === 0
        ? null
        : `${invalidCount} curated AI snapshot${invalidCount === 1 ? "" : "s"} failed validation`;
    if (error) console.error(`[curated-ai-queries] ${error}`);
    return { signals, error };
  } catch (error) {
    if (shouldFailOnDatabaseError()) throw error;
    return { signals: [], error: describe(error) };
  }
}

/**
 * Capped projection of the canonical corpus for public rendering. Topic filters
 * run after validation so callers cannot accidentally derive activity from a
 * different row set or include malformed snapshots.
 */
export async function getCuratedAiSignals({
  limit = 50,
  topicSlug,
  publicResearchEnabled = process.env.PUBLIC_RESEARCH_ENABLED === "true",
}: {
  limit?: number;
  topicSlug?: string;
  publicResearchEnabled?: boolean;
} = {}): Promise<CuratedAiQueryResult> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
  const parsedTopic =
    topicSlug === undefined ? undefined : curatedTopicSlugSchema.safeParse(topicSlug);
  if (parsedTopic && !parsedTopic.success) return { signals: [], error: null };

  const corpus = await getCuratedAiCorpus({ publicResearchEnabled });
  const signals = parsedTopic?.success
    ? corpus.signals.filter((signal) => signal.topicSlugs.includes(parsedTopic.data))
    : corpus.signals;
  return { signals: signals.slice(0, safeLimit), error: corpus.error };
}

/** Admin-only queue: live ingestion fields are review inputs, never public output. */
export async function getCuratedAiAdminQueue(limit = 100): Promise<CuratedAiAdminResult> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
  try {
    const selection = {
      id: items.id,
      type: items.type,
      status: items.status,
      title: items.title,
      url: items.url,
      summary: items.summary,
      aiNote: items.aiNote,
      source: items.source,
      sourceSlug: items.sourceSlug,
      sourceWeight: items.sourceWeight,
      author: items.author,
      score: items.score,
      firstSeen: items.firstSeen,
      publishedAt: items.publishedAt,
      curatedSnapshot: items.curatedSnapshot,
      curatedAt: items.curatedAt,
      curatedBy: items.curatedBy,
    };
    const db = getDb();
    // A recent-candidate cap must never strand an older public snapshot. Every
    // curated (including partially-corrupt) row stays reachable for unpublish.
    const [curatedRows, candidateRows] = await Promise.all([
      db
        .select(selection)
        .from(items)
        .where(
          and(
            eq(items.status, "approved"),
            or(
              isNotNull(items.curatedSnapshot),
              isNotNull(items.curatedAt),
              isNotNull(items.curatedBy),
            ),
          ),
        )
        .orderBy(desc(items.curatedAt), desc(items.id)),
      db
        .select(selection)
        .from(items)
        .where(
          and(
            eq(items.status, "approved"),
            isNull(items.curatedSnapshot),
            isNull(items.curatedAt),
            isNull(items.curatedBy),
          ),
        )
        .orderBy(desc(items.score), desc(items.id))
        .limit(safeLimit),
    ]);
    const rows = [...curatedRows, ...candidateRows];

    return {
      items: rows.map((row) => {
        const hasCuratedState = Boolean(
          row.curatedSnapshot !== null || row.curatedAt !== null || row.curatedBy !== null,
        );
        const signal = hasCuratedState
          ? parseCuratedAiRow({
              itemId: row.id,
              type: row.type,
              status: row.status,
              score: row.score,
              curatedSnapshot: row.curatedSnapshot,
              curatedAt: row.curatedAt,
              curatedBy: row.curatedBy,
            })
          : null;

        return {
          id: row.id,
          type: row.type,
          title: row.title,
          url: row.url,
          summary: row.summary,
          aiNote: row.aiNote,
          source: row.source,
          sourceSlug: row.sourceSlug,
          score: row.score,
          firstSeen: row.firstSeen.toISOString(),
          publishedAt: row.publishedAt?.toISOString() ?? null,
          expectedSourceVersion: curatedAiSourceVersion(row),
          expectedCurationVersion: hasCuratedState
            ? curatedAiCurationVersion(row)
            : null,
          signal,
          hasCuratedState,
          curationError:
            hasCuratedState && !signal
              ? "Stored curation is incomplete or invalid. Unpublish it before reviewing again."
              : null,
        };
      }),
      error: null,
    };
  } catch (error) {
    if (shouldFailOnDatabaseError()) throw error;
    return { items: [], error: describe(error) };
  }
}
