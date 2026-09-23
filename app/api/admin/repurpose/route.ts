import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { repurposeJobs } from "@/db/schema";
import { authorizeAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { LAUNCH_PLATFORMS, isCopyReadyPlatform } from "@/lib/repurpose/launch-policy";
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
    action: z.enum(["save", "approve", "reject"]),
    draft: z.string().min(1).optional(),
    scheduledFor: z.iso.datetime().optional(),
  })
  .strict();

/**
 * Launch approval is copy-ready only. It records the human-reviewed LinkedIn copy and
 * never contacts a social network. Manual paste is the publication boundary.
 */
export async function POST(request: Request) {
  if (!authorizeAdmin(request)) return adminUnauthorizedResponse();

  const body = await readBoundedJsonMutation(request, JSON_BODY_LIMITS.admin);
  if (!body.ok) return body.response;

  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must be { id, action, draft?, scheduledFor? }" }, { status: 400 });
  }

  const { id, action, draft } = parsed.data;
  const db = getDb();

  const [job] = await db.select().from(repurposeJobs).where(eq(repurposeJobs.id, id)).limit(1);
  if (!job) return NextResponse.json({ error: "No such job" }, { status: 404 });

  if (["approved", "scheduled", "published"].includes(job.status)) {
    if (action === "approve" && job.status === "approved") {
      return NextResponse.json({ ok: true, status: "approved", copyReady: true });
    }
    return NextResponse.json(
      { error: `Already ${job.status} — reject explicitly before regenerating.` },
      { status: 409 },
    );
  }

  if (action === "save") {
    await db
      .update(repurposeJobs)
      .set({ draft: draft ?? job.draft, updatedAt: new Date() })
      .where(eq(repurposeJobs.id, id));
    return NextResponse.json({ ok: true, status: job.status });
  }

  if (action === "reject") {
    await db
      .update(repurposeJobs)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(repurposeJobs.id, id));
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // approve → freeze human-reviewed copy for manual publication
  const text = draft ?? job.draft;
  if (!isCopyReadyPlatform(job.platform)) {
    return NextResponse.json(
      { error: `Only ${LAUNCH_PLATFORMS.join(" and ")} copy is enabled for the launch.` },
      { status: 409 },
    );
  }

  await db
    .update(repurposeJobs)
    .set({
      status: "approved",
      draft: text,
      error: null,
      scheduledFor: null,
      updatedAt: new Date(),
    })
    .where(eq(repurposeJobs.id, id));

  return NextResponse.json({
    ok: true,
    status: "approved",
    copyReady: true,
    next: `Copy the approved draft into ${job.platform} manually.`,
  });
}
