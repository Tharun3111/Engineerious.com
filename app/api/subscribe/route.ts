import { NextResponse } from "next/server";
import { z } from "zod";

import { captureAndSyncSubscriber } from "@/lib/subscriber-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const bodySchema = z
  .object({
    email: z.string().trim().toLowerCase().max(320).pipe(z.email()),
    // Hidden from people and accessibility tools. A filled value is treated as a
    // bot submission and intentionally produces no database or provider writes.
    company: z.string().max(200).optional().default(""),
  })
  .strict();

function response(
  body: { ok: boolean; error?: string },
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return response({ ok: false, error: "Enter a valid email address." }, 400);
  }

  // Keep the honeypot inert and enumeration-safe: bots receive the same successful
  // shape as a captured request, but no address or provider state is touched.
  if (parsed.data.company.trim()) {
    return response({ ok: true });
  }

  try {
    // Postgres capture happens inside this helper before either provider call.
    // Provider failures return a pending state without discarding the address.
    await captureAndSyncSubscriber(parsed.data.email);
    // Never expose new/existing, sync, or provider opt-out state. Those details
    // belong only in the authenticated delivery-repair queue.
    return response({ ok: true });
  } catch (error) {
    console.error("[subscribe] durable capture failed", error);
    return response(
      {
        ok: false,
        error: "We couldn't save this email. Try again in a few minutes.",
      },
      502,
    );
  }
}
