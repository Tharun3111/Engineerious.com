import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { items } from "@/db/schema";
import { authorizeAdmin } from "@/lib/auth";
import {
  CURATED_AI_CATEGORIES,
  CURATED_AI_TOPIC_SLUGS,
  parseCuratedAiSnapshot,
} from "@/lib/curated-ai";
import { CURATED_AI_CACHE_TAG } from "@/lib/curated-ai-queries";
import {
  curatedAiCurationVersion,
  curatedAiSourceVersion,
} from "@/lib/curated-ai-source-version";
import { getDb } from "@/lib/db";
import {
  adminUnauthorizedResponse,
  JSON_BODY_LIMITS,
  readBoundedJsonMutation,
} from "@/lib/request-safety";
import { AUTHOR_NAME } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reviewedText = (label: string) => z.string().trim().min(1, `${label} is required.`);
const topicSlugsSchema = z
  .array(z.enum(CURATED_AI_TOPIC_SLUGS))
  .max(CURATED_AI_TOPIC_SLUGS.length)
  .superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", message: "Topic slugs must be unique." });
    }
  });

const bodySchema = z.discriminatedUnion("action", [
  z
    .object({
      id: z.number().int().positive(),
      action: z.literal("publish"),
      expectedSourceVersion: z.string().regex(/^[a-f0-9]{64}$/, "Source version is invalid."),
      title: reviewedText("Title"),
      summary: reviewedText("Summary"),
      category: z.enum(CURATED_AI_CATEGORIES),
      topicSlugs: topicSlugsSchema,
      whyItMatters: reviewedText("Why it matters"),
    })
    .strict(),
  z
    .object({
      id: z.number().int().positive(),
      action: z.literal("unpublish"),
      expectedCurationVersion: z
        .string()
        .regex(/^[a-f0-9]{64}$/, "Curation version is invalid."),
    })
    .strict(),
]);

function revalidateCuratedSurfaces(): void {
  // Editorial removal must not serve a stale snapshot under SWR semantics.
  revalidateTag(CURATED_AI_CACHE_TAG, { expire: 0 });
  for (const path of [
    "/",
    "/ai",
    "/topics/rag",
    "/topics/agents",
    "/topics/mcp",
    "/api/search",
    "/sitemap.xml",
  ]) {
    revalidatePath(path);
  }
}

function iso(value: Date): string {
  const result = value.toISOString();
  if (Number.isNaN(new Date(result).getTime())) throw new Error("Invalid item timestamp.");
  return result;
}

/** Explicit human curation boundary. Raw ingestion fields are copied server-side. */
export async function POST(request: Request) {
  if (!authorizeAdmin(request)) return adminUnauthorizedResponse();

  const body = await readBoundedJsonMutation(request, JSON_BODY_LIMITS.admin);
  if (!body.ok) return body.response;

  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid curation request." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [item] = await db
    .select({
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
      publishedAt: items.publishedAt,
      firstSeen: items.firstSeen,
      curatedSnapshot: items.curatedSnapshot,
      curatedAt: items.curatedAt,
      curatedBy: items.curatedBy,
    })
    .from(items)
    .where(and(eq(items.id, parsed.data.id), eq(items.status, "approved")))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: "No approved item with that ID." }, { status: 404 });
  }

  if (parsed.data.action === "unpublish") {
    const alreadyClear =
      item.curatedSnapshot === null && item.curatedAt === null && item.curatedBy === null;
    if (alreadyClear) {
      return NextResponse.json({ ok: true, status: "unpublished", idempotent: true });
    }
    if (curatedAiCurationVersion(item) !== parsed.data.expectedCurationVersion) {
      return NextResponse.json(
        { error: "The curated snapshot changed after this review form loaded. Reload before removing it." },
        { status: 409 },
      );
    }

    const [updated] = await db
      .update(items)
      .set({ curatedSnapshot: null, curatedAt: null, curatedBy: null })
      .where(
        and(
          eq(items.id, item.id),
          eq(items.status, "approved"),
          item.curatedSnapshot === null
            ? isNull(items.curatedSnapshot)
            : eq(items.curatedSnapshot, item.curatedSnapshot),
          item.curatedAt === null
            ? isNull(items.curatedAt)
            : eq(items.curatedAt, item.curatedAt),
          item.curatedBy === null
            ? isNull(items.curatedBy)
            : eq(items.curatedBy, item.curatedBy),
        ),
      )
      .returning({ id: items.id });

    if (!updated) {
      return NextResponse.json(
        { error: "Item status changed before curation could be removed." },
        { status: 409 },
      );
    }
    revalidateCuratedSurfaces();
    return NextResponse.json({ ok: true, id: updated.id, status: "unpublished" });
  }

  if (curatedAiSourceVersion(item) !== parsed.data.expectedSourceVersion) {
    return NextResponse.json(
      { error: "The source record changed after this review form loaded. Reload and review it again." },
      { status: 409 },
    );
  }

  if (item.curatedSnapshot !== null || item.curatedAt !== null || item.curatedBy !== null) {
    return NextResponse.json(
      { error: "This item already has a curated snapshot. Unpublish it before publishing a revision." },
      { status: 409 },
    );
  }

  let snapshot;
  try {
    snapshot = parseCuratedAiSnapshot({
      schemaVersion: 1,
      itemId: item.id,
      type: item.type,
      title: parsed.data.title,
      url: item.url,
      summary: parsed.data.summary,
      category: parsed.data.category,
      topicSlugs: parsed.data.topicSlugs,
      whyItMatters: parsed.data.whyItMatters,
      source: item.source,
      sourceSlug: item.sourceSlug,
      sourceWeight: item.sourceWeight,
      author: item.author,
      sourcePublishedAt: item.publishedAt ? iso(item.publishedAt) : null,
      firstSeen: iso(item.firstSeen),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `The reviewed snapshot is invalid: ${error.message}`
            : "The reviewed snapshot is invalid.",
      },
      { status: 400 },
    );
  }

  const curatedAt = new Date();
  const [updated] = await db
    .update(items)
    .set({ curatedSnapshot: snapshot, curatedAt, curatedBy: AUTHOR_NAME })
    .where(
      and(
        eq(items.id, item.id),
        eq(items.status, "approved"),
        eq(items.type, item.type),
        eq(items.title, item.title),
        eq(items.url, item.url),
        item.summary === null ? isNull(items.summary) : eq(items.summary, item.summary),
        item.aiNote === null ? isNull(items.aiNote) : eq(items.aiNote, item.aiNote),
        eq(items.source, item.source),
        eq(items.sourceSlug, item.sourceSlug),
        eq(items.sourceWeight, item.sourceWeight),
        item.author === null ? isNull(items.author) : eq(items.author, item.author),
        item.publishedAt === null
          ? isNull(items.publishedAt)
          : eq(items.publishedAt, item.publishedAt),
        eq(items.firstSeen, item.firstSeen),
        isNull(items.curatedSnapshot),
        isNull(items.curatedAt),
        isNull(items.curatedBy),
      ),
    )
    .returning({ id: items.id });

  if (!updated) {
    return NextResponse.json(
      { error: "Item changed while the snapshot was being published. Reload before retrying." },
      { status: 409 },
    );
  }

  revalidateCuratedSurfaces();
  return NextResponse.json({
    ok: true,
    id: updated.id,
    status: "published",
    curatedAt: curatedAt.toISOString(),
  });
}
