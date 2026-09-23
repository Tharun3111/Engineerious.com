import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeAdmin } from "@/lib/auth";
import {
  adminUnauthorizedResponse,
  JSON_BODY_LIMITS,
  readBoundedJsonMutation,
} from "@/lib/request-safety";
import { retrySubscriberSync } from "@/lib/subscriber-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const bodySchema = z
  .object({
    action: z.literal("retry_sync"),
    id: z.number().int().positive(),
  })
  .strict();

export async function POST(request: Request) {
  if (!authorizeAdmin(request)) return adminUnauthorizedResponse();

  const body = await readBoundedJsonMutation(request, JSON_BODY_LIMITS.admin);
  if (!body.ok) return body.response;

  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose one captured subscriber to retry." },
      { status: 400 },
    );
  }

  try {
    // One id per request keeps repair attempts bounded and independently auditable.
    const result = await retrySubscriberSync(parsed.data.id);
    if (result.outcome === "missing") {
      return NextResponse.json({ error: "Subscriber not found." }, { status: 404 });
    }
    if (result.outcome === "inactive") {
      return NextResponse.json(
        { error: "This subscriber is inactive and was not synced." },
        { status: 409 },
      );
    }
    if (result.outcome === "pending") {
      return NextResponse.json(
        {
          error:
            result.error ??
            "The contact is still pending. Check the newsletter configuration and try again.",
          delivery: "pending",
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      delivery: "ready",
    });
  } catch (error) {
    console.error("[admin/subscribers] retry failed", error);
    return NextResponse.json(
      { error: "Subscriber sync couldn't finish. Check the database and try again." },
      { status: 502 },
    );
  }
}
