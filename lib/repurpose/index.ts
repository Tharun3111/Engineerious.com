import { readFileSync } from "node:fs";
import { join } from "node:path";

import { notInArray } from "drizzle-orm";

import { repurposeJobs, type Platform } from "@/db/schema";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { complete, PRAGMATIC_PRACTITIONER } from "@/lib/llm";
import type { BlogPost } from "@/lib/content/blog";
import { syncPost } from "@/lib/content/sync";
import { LAUNCH_PLATFORMS } from "@/lib/repurpose/launch-policy";

/**
 * One flagship post fans out to five platform-native drafts. Every draft lands as
 * `pending_review`. Nothing in this file talks to a social network — publishing is
 * behind a human approval gate in /admin (see lib/repurpose/publisher.ts).
 */

export const PLATFORMS = ["linkedin", "x", "instagram", "youtube", "facebook"] as const;
export { LAUNCH_PLATFORMS } from "@/lib/repurpose/launch-policy";

const PROMPT_DIR = join(process.cwd(), "content", "prompts");

/** Trimmed so a long article does not blow the context or the bill. */
const MAX_BODY_CHARS = 12_000;

function template(platform: Platform): string {
  return readFileSync(join(PROMPT_DIR, `${platform}.md`), "utf8");
}

function render(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function postUrl(slug: string): string {
  return `${env.siteUrl.replace(/\/$/, "")}/blog/${slug}`;
}

export async function generateDraft(post: BlogPost, platform: Platform): Promise<string> {
  const prompt = render(template(platform), {
    title: post.title,
    dek: post.dek,
    pillar: post.pillar,
    url: post.canonical ?? postUrl(post.slug),
    body: post.body.slice(0, MAX_BODY_CHARS),
  });

  return complete({
    system: PRAGMATIC_PRACTITIONER,
    prompt,
    maxTokens: 2000,
  });
}

export type RepurposeResult = {
  platform: Platform;
  ok: boolean;
  error?: string;
};

/**
 * Generate (or regenerate) drafts for a post. Existing rows are overwritten unless
 * they have already been published — a published post's draft is the historical
 * record of what went out.
 */
export async function repurpose(
  post: BlogPost,
  platforms: readonly Platform[] = LAUNCH_PLATFORMS,
): Promise<RepurposeResult[]> {
  await syncPost(post);
  const db = getDb();

  return Promise.all(
    platforms.map(async (platform): Promise<RepurposeResult> => {
      try {
        const draft = await generateDraft(post, platform);
        if (!draft) throw new Error("model returned an empty draft");

        await db
          .insert(repurposeJobs)
          .values({ postSlug: post.slug, platform, draft, status: "pending_review" })
          .onConflictDoUpdate({
            target: [repurposeJobs.postSlug, repurposeJobs.platform],
            set: { draft, status: "pending_review", error: null, updatedAt: new Date() },
            // Approved copy is the human-reviewed historical record. Never replace it
            // unless the reviewer explicitly rejects and regenerates it.
            setWhere: notInArray(repurposeJobs.status, ["approved", "scheduled", "published"]),
          });

        return { platform, ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[repurpose] ${post.slug}/${platform}:`, message);
        return { platform, ok: false, error: message };
      }
    }),
  );
}
