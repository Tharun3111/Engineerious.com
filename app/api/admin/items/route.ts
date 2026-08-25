import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { items } from "@/db/schema";
import { CURATED_AI_CACHE_TAG } from "@/lib/curated-ai-queries";
import { getDb } from "@/lib/db";
import { FEED_CACHE_TAG } from "@/lib/queries";

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

/** Moderate an ingested item. Gated by proxy.ts. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must be { id, action }" }, { status: 400 });
  }

  const { id, action } = parsed.data;

  const update =
    action === "reject"
      ? {
          status: "rejected" as const,
          curatedSnapshot: null,
          curatedAt: null,
          curatedBy: null,
        }
      : { status: "approved" as const };

  const updated = await getDb()
    .update(items)
    // Rejection and public unpublication are one atomic state transition. An
    // approval changes moderation state only; it never creates a snapshot.
    .set(update)
    .where(eq(items.id, id))
    .returning({ id: items.id, status: items.status });

  if (updated.length === 0) return NextResponse.json({ error: "No such item" }, { status: 404 });

  revalidateItemSurfaces();

  return NextResponse.json({ ok: true, ...updated[0] });
}
