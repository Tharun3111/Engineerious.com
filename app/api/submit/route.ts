import { NextResponse } from "next/server";
import { z } from "zod";

import { submissions } from "@/db/schema";
import { getDb } from "@/lib/db";
import { shouldCloseResearchPath } from "@/lib/public-launch";

export const runtime = "nodejs";

const bodySchema = z.object({
  type: z.enum(["news", "model", "oss"]),
  title: z.string().min(3).max(200),
  url: z.url(),
  note: z.string().max(280).optional().or(z.literal("")),
  submitterEmail: z.email().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  // /api routes are excluded from the broad middleware matcher. Enforce the same
  // launch boundary at the mutation itself so a caller cannot bypass the closed
  // /submit page with a direct POST.
  if (shouldCloseResearchPath("/submit", process.env.PUBLIC_RESEARCH_ENABLED)) {
    return NextResponse.json(
      { ok: false, error: "Not found." },
      { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Check the URL and title, then try again." },
      { status: 400 },
    );
  }

  const { type, title, url, note, submitterEmail } = parsed.data;

  try {
    await getDb()
      .insert(submissions)
      .values({
        type,
        title: title.trim(),
        url,
        note: note || null,
        submitterEmail: submitterEmail || null,
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[submit]", error);
    return NextResponse.json(
      { ok: false, error: "We couldn't submit this link. Try again in a few minutes." },
      { status: 503 },
    );
  }
}
