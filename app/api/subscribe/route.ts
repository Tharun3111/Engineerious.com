import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { subscribers } from "@/db/schema";
import { getDb } from "@/lib/db";
import { sendWelcomeEmail, upsertContact } from "@/lib/resend";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.email() });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  const email = parsed.data.email;

  // There used to be a `resendConfigured()` guard here that 503'd before this insert.
  // It contradicted the very next comment: an unset RESEND_* var meant the address was
  // rejected AND never stored, so every signup during a config gap was lost with no
  // record anywhere. Both Resend calls below already fail safe (upsertContact throws
  // into a catch, sendWelcomeEmail no-ops), so capture is now unconditional and the
  // email delivery is what degrades.
  //
  // Postgres is the source of truth: write it first so a Resend outage never loses a
  // signup. `onConflictDoNothing` makes re-submitting an already-subscribed email a
  // harmless no-op rather than a duplicate-key error. `.returning()` tells us whether a
  // row was actually inserted, which gates the welcome email below — without it, a
  // resubmission of an already-subscribed address would re-trigger the welcome send.
  let isNewSubscriber: boolean;
  try {
    const inserted = await getDb()
      .insert(subscribers)
      .values({ email })
      .onConflictDoNothing({ target: subscribers.email })
      .returning({ id: subscribers.id });
    isNewSubscriber = inserted.length > 0;
  } catch (error) {
    console.error("[subscribe]", error);
    return NextResponse.json(
      { ok: false, error: "We couldn't subscribe this email. Try again in a few minutes." },
      { status: 502 },
    );
  }

  // Best-effort: the subscriber is already durably recorded above even if this fails.
  try {
    const contactId = await upsertContact(email);
    await getDb()
      .update(subscribers)
      .set({ resendContactId: contactId })
      .where(eq(subscribers.email, email));
  } catch (error) {
    console.error("[subscribe] Resend contact upsert failed (subscriber row still saved):", error);
  }

  // Best-effort, same reasoning — the subscriber is already saved regardless. This is
  // the ONLY signal a new subscriber gets that anything happened; without it they see
  // a form that appears to do nothing. Gated on isNewSubscriber so resubmitting an
  // already-subscribed email doesn't re-send the welcome message every time.
  if (isNewSubscriber) {
    try {
      await sendWelcomeEmail(email);
    } catch (error) {
      console.error("[subscribe] welcome email failed (subscriber row still saved):", error);
    }
  }

  return NextResponse.json({ ok: true });
}
