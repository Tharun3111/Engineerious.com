import { sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { authorizeCron } from "@/lib/auth";
import { CURATED_AI_CACHE_TAG } from "@/lib/curated-ai-queries";
import { getDb } from "@/lib/db";
import { FEED_CACHE_TAG } from "@/lib/queries";
import { AGE_OFFSET_HOURS, GRAVITY, POINTS_OFFSET } from "@/lib/ranking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rescore in one UPDATE rather than reading rows into JS — the formula is pure
 * arithmetic over columns Postgres already has:
 *
 *   score = (points - 1 + source_weight) / (age_hours + 2) ^ 1.8
 *
 * Scoped to the last 60 days. Beyond that the decay term has already driven score
 * below anything on a feed page, so rewriting those rows on every sweep is waste.
 * lib/ranking.ts holds the same formula for insert-time scoring — keep them in sync.
 */
const RESCORE_WINDOW_DAYS = 60;

export async function GET(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  try {
    const result = await getDb().execute(sql`
      update items
         set score = (points - ${POINTS_OFFSET} + source_weight)
                     / power(
                         greatest(
                           0,
                           extract(epoch from (now() - coalesce(published_at, first_seen))) / 3600
                         ) + ${AGE_OFFSET_HOURS},
                         ${GRAVITY}
                       ),
             ranked_at = now()
       where coalesce(published_at, first_seen) > now() - interval '${sql.raw(String(RESCORE_WINDOW_DAYS))} days'
    `);

    // Ordering just changed, so the cached feed slices are stale by definition.
    revalidateTag(FEED_CACHE_TAG, "max");
    revalidateTag(CURATED_AI_CACHE_TAG, { expire: 0 });

    return NextResponse.json({
      ok: true,
      gravity: GRAVITY,
      ageOffsetHours: AGE_OFFSET_HOURS,
      pointsOffset: POINTS_OFFSET,
      windowDays: RESCORE_WINDOW_DAYS,
      // rowCount's shape differs slightly between the neon-http and node-postgres
      // drivers (see lib/db.ts) — read it defensively rather than typing around it.
      rescored: (result as { rowCount?: number }).rowCount ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/rank]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
