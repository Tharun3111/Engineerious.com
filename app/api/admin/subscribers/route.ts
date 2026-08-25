import { NextResponse } from "next/server";
import { z } from "zod";

import { ADMIN_REALM, authorizeAdmin } from "@/lib/auth";
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

function mutationRequestError(request: Request): NextResponse | null {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return NextResponse.json(
      { error: "Content-Type must be application/json." },
      { status: 415 },
    );
  }

  if (request.headers.get("sec-fetch-site")?.trim().toLowerCase() === "cross-site") {
    return NextResponse.json({ error: "Cross-site admin mutations are forbidden." }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    let requestOriginMatches = false;
    try {
      requestOriginMatches = new URL(origin).origin === new URL(request.url).origin;
    } catch {
      requestOriginMatches = false;
    }
    if (!requestOriginMatches) {
      return NextResponse.json(
        { error: "Foreign-origin admin mutations are forbidden." },
        { status: 403 },
      );
    }
  }
  return null;
}

export async function POST(request: Request) {
  if (!authorizeAdmin(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "www-authenticate": ADMIN_REALM } },
    );
  }
  const unsafeRequest = mutationRequestError(request);
  if (unsafeRequest) return unsafeRequest;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
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
