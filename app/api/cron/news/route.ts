import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { newsAdapters } from "@/lib/adapters";
import { authorizeCron } from "@/lib/auth";
import { ingestHttpStatus, runIngest, summarise } from "@/lib/ingest";
import { FEED_CACHE_TAG } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Hourly on Vercel Pro; daily on Hobby (see vercel.json and README). */
export async function GET(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const results = await runIngest(newsAdapters());
  revalidateTag(FEED_CACHE_TAG, "max");
  return NextResponse.json(
    { feed: "news", ...summarise(results) },
    { status: ingestHttpStatus(results) },
  );
}
