import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { items } from "@/db/schema";
import { getDb } from "@/lib/db";
import { FEED_CACHE_TAG } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.number().int().positive(),
  action: z.enum(["approve", "reject"]),
});

/** Moderate an ingested item. Gated by middleware.ts. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must be { id, action }" }, { status: 400 });
  }

  const { id, action } = parsed.data;

  const updated = await getDb()
    .update(items)
    .set({ status: action === "approve" ? "approved" : "rejected" })
    .where(eq(items.id, id))
    .returning({ id: items.id, status: items.status });

  if (updated.length === 0) return NextResponse.json({ error: "No such item" }, { status: 404 });

  // An approval must show up on the feeds immediately, not in five minutes.
  revalidateTag(FEED_CACHE_TAG);

  return NextResponse.json({ ok: true, ...updated[0] });
}
