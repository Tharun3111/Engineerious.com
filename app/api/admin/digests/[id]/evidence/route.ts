import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { digests, researchRuns } from "@/db/schema";
import { authorizeAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * The editor fetches the large research payload only when a reviewer asks to see
 * it. This endpoint sits under the existing /api/admin proxy boundary and repeats
 * the credential check so a direct route invocation still fails closed.
 */
export async function GET(request: Request, { params }: RouteContext) {
  if (!authorizeAdmin(request)) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rawId = (await params).id;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== rawId) {
    return NextResponse.json({ error: "Digest id must be a positive integer." }, { status: 400 });
  }

  const db = getDb();
  const [[digest], [research]] = await Promise.all([
    db
      .select({ id: digests.id, date: digests.date })
      .from(digests)
      .where(eq(digests.id, id))
      .limit(1),
    db
      .select({
        findings: researchRuns.findings,
        coverageNotes: researchRuns.coverageNotes,
        gatheredItems: researchRuns.gatheredItems,
        tavilyCreditsUsed: researchRuns.tavilyCreditsUsed,
      })
      .from(researchRuns)
      .where(eq(researchRuns.digestId, id))
      .limit(1),
  ]);

  if (!digest) {
    return NextResponse.json({ error: "Digest not found." }, { status: 404 });
  }

  if (!research) {
    return NextResponse.json({ error: "No research evidence is stored for this digest." }, { status: 404 });
  }

  return NextResponse.json({
    digestId: digest.id,
    date: digest.date,
    findings: research.findings ?? [],
    coverageNotes: research.coverageNotes ?? "",
    gatheredItems: research.gatheredItems ?? [],
    tavilyCreditsUsed: research.tavilyCreditsUsed,
  });
}
