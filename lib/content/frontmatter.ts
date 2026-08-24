import { z } from "zod";

import { PILLAR_SLUGS, type PillarSlug } from "@/lib/pillars";

const frontmatterSchema = z
  .object({
    title: z.string().min(1),
    dek: z.string().min(1),
    pillar: z.enum(PILLAR_SLUGS as unknown as [PillarSlug, ...PillarSlug[]]),
    date: z.coerce.date(),
    canonical: z.string().url().optional(),
    hero: z.string().optional(),
    tags: z.array(z.string()).default([]),
    /*
     * The signature element of the redesign (see .scope in app/globals.css and
     * components/ScopeBlock.tsx): what a reader will be able to do after this
     * entry, and what it deliberately does not cover. Both default to empty —
     * ScopeBlock renders nothing rather than a hollow box when neither is set,
     * so an unfilled post degrades to exactly what it looked like before this
     * field existed.
     */
    teaches: z.array(z.string()).default([]),
    notCovered: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    format: z.enum(["article", "model_note", "field_note"]),
    origin: z.enum(["human", "ai_assisted", "ai_generated"]),
    sourceStatus: z.enum(["primary", "secondary", "mixed"]),
    testedStatus: z.enum(["not_tested", "tested_once", "replicated"]),
    authenticityStatus: z.enum(["pending", "verified"]),
    reviewedBy: z.string().min(1).optional(),
    reviewedAt: z.coerce.date().optional(),
  })
  .superRefine((post, ctx) => {
    if (post.authenticityStatus !== "verified") return;
    if (!post.reviewedBy) {
      ctx.addIssue({
        code: "custom",
        path: ["reviewedBy"],
        message: "Verified content requires reviewedBy.",
      });
    }
    if (!post.reviewedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["reviewedAt"],
        message: "Verified content requires reviewedAt.",
      });
    }
  });

export type Frontmatter = z.infer<typeof frontmatterSchema>;

export function parseFrontmatter(data: unknown, sourceName: string): Frontmatter {
  const parsed = frontmatterSchema.safeParse(data);
  if (parsed.success) return parsed.data;
  throw new Error(`Invalid frontmatter in ${sourceName}: ${JSON.stringify(parsed.error.issues)}`);
}

/**
 * First-person claims of work the author personally did: "I built", "I ran",
 * "in my experience", "what I run now". Deliberately narrow — it matches claims of
 * *doing*, not first-person opinion ("I think", "I'd argue"), which a machine draft
 * may legitimately carry once a human adopts it.
 */
const EXPERIENTIAL_CLAIM =
  /\b(?:I|we)\s+(?:built|ran|run|tested|measured|benchmarked|deployed|shipped|reverse-engineered|instrumented|profiled|debugged)\b|\bin\s+my\s+experience\b|\bwhat\s+I\s+run\s+now\b|\bmy\s+own\s+(?:workload|system|setup|cluster|deployment)/i;

/**
 * The gap the schema above could not see. `superRefine` validates who *signed* a
 * post; it never validated whether the post's "I" is real. That let this ship into
 * content/blog/45-eval-metrics-six-that-mattered.mdx, `origin: ai_generated`,
 * `testedStatus: not_tested`, one `draft: false` away from publication:
 *
 *   title: "I reverse-engineered 45 eval metrics. Six of them predicted anything."
 *   body:  "The first eval suite I built for a production RAG assistant had 45
 *           metrics in it." … "So I built the cheapest possible version of that
 *           experiment:"
 *
 * That experiment was never run. A machine wrote a first-person account of work
 * nobody did, in Tharun's voice, under Tharun's byline — on a site whose entire
 * proposition is that provenance is enforced rather than promised. Publishing it
 * would not have been an ordinary AI-content misstep; it would have been the
 * failure the whole apparatus exists to prevent, committed by the apparatus.
 *
 * A machine draft may report, analyse and cite. It may not claim to have done
 * things. Marking the post `tested` is not an escape hatch either — the point is
 * authorship of the experience, so the only way to carry these claims is for a
 * human to actually own the text (`origin: human` or `ai_assisted`).
 */
export function findFabricatedExperienceClaims(
  frontmatter: Pick<Frontmatter, "title" | "dek" | "origin">,
  body: string,
): string[] {
  if (frontmatter.origin !== "ai_generated") return [];

  const found: string[] = [];
  for (const [label, text] of [
    ["title", frontmatter.title],
    ["dek", frontmatter.dek],
    ["body", body],
  ] as const) {
    for (const line of text.split("\n")) {
      const match = line.match(EXPERIENTIAL_CLAIM);
      if (match) found.push(`${label}: "${match[0].trim()}"`);
    }
  }
  return found;
}

/**
 * Throws when a machine-drafted post claims first-hand work. Called from the MDX
 * loader so a fabricated anecdote fails the build rather than reaching review as a
 * plausible-looking draft a tired human might wave through.
 */
export function assertNoFabricatedExperience(
  frontmatter: Pick<Frontmatter, "title" | "dek" | "origin">,
  body: string,
  sourceName: string,
): void {
  const claims = findFabricatedExperienceClaims(frontmatter, body);
  if (claims.length === 0) return;
  throw new Error(
    `${sourceName} is origin: ai_generated but claims first-hand work — ${claims.join("; ")}. ` +
      `A machine draft may report and cite, not claim to have done things. Either rewrite ` +
      `the claim out, or take authorship with origin: human / ai_assisted.`,
  );
}
