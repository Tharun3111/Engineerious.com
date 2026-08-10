import { NextResponse } from "next/server";
import { z } from "zod";

import { beehiivConfigured, subscribe } from "@/lib/beehiiv";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.email() });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }

  if (!beehiivConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Newsletter is not connected yet. Set BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID.",
      },
      { status: 503 },
    );
  }

  try {
    await subscribe(parsed.data.email, request.headers.get("referer") ?? undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[subscribe]", message);
    // Do not leak the upstream body to the browser — it can contain the publication id.
    return NextResponse.json(
      { ok: false, error: "Could not subscribe right now. Try again shortly." },
      { status: 502 },
    );
  }
}
