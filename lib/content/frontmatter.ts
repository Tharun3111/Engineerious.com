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
