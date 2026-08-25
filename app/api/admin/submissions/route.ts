import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { items, submissions } from "@/db/schema";
import { getDb } from "@/lib/db";
import { hostname, urlHash } from "@/lib/dedupe";
import { FEED_CACHE_TAG } from "@/lib/queries";
import { computeScore } from "@/lib/ranking";
import { SOURCE_WEIGHTS } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.number().int().positive(),
  action: z.enum(["accept", "reject"]),
});

/** Accepting a submission promotes it into `items` as an approved row. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must be { id, action }" }, { status: 400 });
  }

  const { id, action } = parsed.data;
  const db = getDb();

  const [submission] = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  if (!submission) return NextResponse.json({ error: "No such submission" }, { status: 404 });

  if (action === "reject") {
    await db.update(submissions).set({ status: "rejected" }).where(eq(submissions.id, id));
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const now = new Date();
  const sourceWeight = SOURCE_WEIGHTS.submission;

  await db
    .insert(items)
    .values({
      type: submission.type,
      status: "approved",
      title: submission.title,
      url: submission.url,
      urlHash: urlHash(submission.url),
      summary: submission.note,
      source: hostname(submission.url) || "Submitted",
      sourceSlug: "submission",
      sourceWeight,
      points: 0,
      score: computeScore({ points: 0, sourceWeight, publishedAt: null, firstSeen: now }, now),
      firstSeen: now,
      publishedAt: submission.createdAt,
      rankedAt: now,
      rawJson: { submissionId: submission.id, submitter: submission.submitterEmail },
    })
    // Already ingested from a feed — accepting is then just a no-op on the item.
    .onConflictDoNothing({ target: items.urlHash });

  await db.update(submissions).set({ status: "accepted" }).where(eq(submissions.id, id));
  revalidateTag(FEED_CACHE_TAG, "max");

  return NextResponse.json({ ok: true, status: "accepted" });
}
