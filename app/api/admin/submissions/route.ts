import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { items, submissions } from "@/db/schema";
import { authorizeAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hostname, urlHash } from "@/lib/dedupe";
import { httpUrlSchema } from "@/lib/editorial-safety";
import { FEED_CACHE_TAG } from "@/lib/queries";
import { computeScore } from "@/lib/ranking";
import { SOURCE_WEIGHTS } from "@/lib/sources";
import {
  adminUnauthorizedResponse,
  JSON_BODY_LIMITS,
  readBoundedJsonMutation,
} from "@/lib/request-safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    id: z.number().int().positive(),
    action: z.enum(["accept", "reject"]),
  })
  .strict();

/** Accepting a submission promotes it into `items` as an approved row. */
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

  const [submission] = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  if (!submission) return NextResponse.json({ error: "No such submission" }, { status: 404 });

  if (action === "reject") {
    await db.update(submissions).set({ status: "rejected" }).where(eq(submissions.id, id));
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const safeUrl = httpUrlSchema.safeParse(submission.url);
  if (!safeUrl.success) {
    return NextResponse.json(
      { error: "This legacy submission does not contain a safe HTTP(S) URL. Reject it instead." },
      { status: 409 },
    );
  }

  const now = new Date();
  const sourceWeight = SOURCE_WEIGHTS.submission;

  await db
    .insert(items)
    .values({
      type: submission.type,
      status: "approved",
      title: submission.title,
      url: safeUrl.data,
      urlHash: urlHash(safeUrl.data),
      summary: submission.note,
      source: hostname(safeUrl.data) || "Submitted",
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
