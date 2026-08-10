import { NextResponse } from "next/server";
import { z } from "zod";

import { submissions } from "@/db/schema";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  type: z.enum(["news", "model", "oss"]),
  title: z.string().min(3).max(200),
  url: z.url(),
  note: z.string().max(280).optional().or(z.literal("")),
  submitterEmail: z.email().optional().or(z.literal("")),
});

export async function POST(request: Request) {
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
      { ok: false, error: "Could not save the submission right now." },
      { status: 503 },
    );
  }
}
