import { NextResponse } from "next/server";
import { z } from "zod";

import { submissions } from "@/db/schema";
import { getDb } from "@/lib/db";
import { httpUrlSchema } from "@/lib/editorial-safety";
import { enforcePublicMutationRateLimit } from "@/lib/public-rate-limit";
import { shouldCloseResearchPath } from "@/lib/public-launch";
import { JSON_BODY_LIMITS, readBoundedJsonMutation } from "@/lib/request-safety";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    type: z.enum(["news", "model", "oss"]),
    title: z.string().trim().min(3).max(200),
    url: z.string().trim().pipe(httpUrlSchema),
    note: z.string().trim().max(280).optional().default(""),
    submitterEmail: z
      .string()
      .trim()
      .toLowerCase()
      .max(320)
      .pipe(z.email())
      .or(z.literal(""))
      .optional()
      .default(""),
    // Visually hidden from people. A filled value is acknowledged but never stored.
    company: z.string().max(200).optional().default(""),
  })
  .strict();

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

  const body = await readBoundedJsonMutation(request, JSON_BODY_LIMITS.publicSubmit);
  if (!body.ok) return body.response;

  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Check the URL and title, then try again." },
      { status: 400 },
    );
  }

  const { type, title, url, note, submitterEmail, company } = parsed.data;

  // Do not reveal that the bot trap fired. The response is identical to a stored
  // submission, but the moderation queue and database remain untouched.
  if (company.trim()) {
    return NextResponse.json(
      { ok: true },
      { headers: { "cache-control": "private, no-store" } },
    );
  }

  let rateLimit;
  try {
    rateLimit = await enforcePublicMutationRateLimit({ action: "submit", request });
  } catch {
    rateLimit = { status: "unavailable" } as const;
  }

  if (rateLimit.status === "limited") {
    return NextResponse.json(
      { ok: false, error: "Too many submissions. Try again later." },
      {
        status: 429,
        headers: {
          "cache-control": "private, no-store",
          "retry-after": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }
  if (rateLimit.status === "unavailable") {
    console.error("[submit] public mutation rate limit unavailable");
    return NextResponse.json(
      { ok: false, error: "Submissions are temporarily unavailable." },
      { status: 503, headers: { "cache-control": "private, no-store" } },
    );
  }

  try {
    await getDb()
      .insert(submissions)
      .values({
        type,
        title,
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
