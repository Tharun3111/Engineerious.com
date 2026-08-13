import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeAdmin } from "@/lib/auth";
import { getPost, isPublished } from "@/lib/content/blog";
import { llmConfigured } from "@/lib/llm";
import { PLATFORMS, repurpose } from "@/lib/repurpose";
import { resolveLaunchPlatforms } from "@/lib/repurpose/launch-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  slug: z.string().min(1),
  /** Regenerate a subset, e.g. after editing the prompt template for one platform. */
  platforms: z.array(z.enum(PLATFORMS)).optional(),
});

/**
 * Generate platform-native drafts for a published post.
 *
 * Not on a cron and not triggered by publishing: repurposing costs LLM tokens and the
 * result needs a human read, so it is an explicit action. Every draft it writes is
 * `pending_review`; approval happens in /admin.
 *
 * Auth: Bearer ADMIN_PASSWORD (this path is outside the middleware matcher because it
 * is meant to be callable from a script or CI as well as the browser).
 */
export async function POST(request: Request) {
  if (!authorizeAdmin(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must be { slug, platforms? }" }, { status: 400 });
  }

  let requestedPlatforms;
  try {
    requestedPlatforms = resolveLaunchPlatforms(parsed.data.platforms);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unsupported platform." },
      { status: 400 },
    );
  }

  if (!llmConfigured()) {
    return NextResponse.json(
      { error: "No LLM credentials. Set ANTHROPIC_API_KEY or OPENAI_API_KEY." },
      { status: 503 },
    );
  }

  const post = await getPost(parsed.data.slug);
  if (!post) {
    return NextResponse.json({ error: `No post named ${parsed.data.slug}` }, { status: 404 });
  }
  // getPost() resolves any slug, draft or published, for /admin's preview use. This
  // route spends real LLM tokens producing real distributable drafts, so it always
  // requires the true published state (isPublished, not the dev-preview isVisible) —
  // no legitimate case exists for repurposing a post a human hasn't approved yet.
  if (!isPublished(post)) {
    return NextResponse.json(
      { error: `"${parsed.data.slug}" hasn't been approved yet — repurpose after it's published.` },
      { status: 409 },
    );
  }

  try {
    const results = await repurpose(post, requestedPlatforms);
    return NextResponse.json({
      slug: post.slug,
      generated: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok),
      results,
      next: `Review at /admin, approve the copy, then paste it into ${requestedPlatforms.join(" or ")} manually.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[repurpose]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
