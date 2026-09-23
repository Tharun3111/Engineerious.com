import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { items } from "@/db/schema";
import { authorizeAdmin } from "@/lib/auth";
import { CURATED_AI_CACHE_TAG } from "@/lib/curated-ai-queries";
import { getDb } from "@/lib/db";
import { isHttpUrl } from "@/lib/editorial-safety";
import { FEED_CACHE_TAG } from "@/lib/queries";
import {
  adminUnauthorizedResponse,
  JSON_BODY_LIMITS,
  readBoundedJsonMutation,
} from "@/lib/request-safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.number().int().positive(),
  action: z.enum(["approve", "reject"]),
}).strict();

function revalidateItemSurfaces(): void {
  revalidateTag(FEED_CACHE_TAG, { expire: 0 });
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

/** Moderate an ingested item. The route repeats proxy auth at the mutation boundary. */
export async function POST(request: Request) {
  if (!authorizeAdmin(request)) return adminUnauthorizedResponse();

  const body = await readBoundedJsonMutation(request, JSON_BODY_LIMITS.admin);
  if (!body.ok) return body.response;

  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must be { id, action }" }, { status: 400 });
  }

  const { id, action } = parsed.data;
  const db = getDb();

  let reviewedUrl: string | null = null;
  if (action === "approve") {
    const [candidate] = await db
      .select({ url: items.url })
      .from(items)
      .where(eq(items.id, id))
      .limit(1);
    if (!candidate) return NextResponse.json({ error: "No such item" }, { status: 404 });
    if (!isHttpUrl(candidate.url)) {
      return NextResponse.json(
        { error: "This legacy item has an unsafe source URL and cannot be approved." },
        { status: 400 },
      );
    }
    reviewedUrl = candidate.url;
  }

  const update =
    action === "reject"
      ? {
          status: "rejected" as const,
          curatedSnapshot: null,
          curatedAt: null,
          curatedBy: null,
        }
      : { status: "approved" as const };

  const updated = await db
    .update(items)
    // Rejection and public unpublication are one atomic state transition. An
    // approval changes moderation state only; it never creates a snapshot.
    .set(update)
    .where(
      reviewedUrl === null
        ? eq(items.id, id)
        : and(eq(items.id, id), eq(items.url, reviewedUrl)),
    )
    .returning({ id: items.id, status: items.status });

  if (updated.length === 0) {
    return NextResponse.json(
      { error: reviewedUrl ? "Item changed while it was being approved. Reload and retry." : "No such item" },
      { status: reviewedUrl ? 409 : 404 },
    );
  }

  revalidateItemSurfaces();

  return NextResponse.json({ ok: true, ...updated[0] });
}
