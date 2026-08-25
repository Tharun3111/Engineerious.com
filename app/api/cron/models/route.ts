import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { modelAdapters } from "@/lib/adapters";
import { authorizeCron } from "@/lib/auth";
import { ingestHttpStatus, runIngest, summarise } from "@/lib/ingest";
import { FEED_CACHE_TAG } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily. Model releases do not move fast enough to justify hourly Hub calls. */
export async function GET(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const results = await runIngest(modelAdapters());
  revalidateTag(FEED_CACHE_TAG, "max");
  return NextResponse.json(
    { feed: "models", ...summarise(results) },
    { status: ingestHttpStatus(results) },
  );
}
