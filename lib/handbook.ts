import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import matter from "gray-matter";
import { cache } from "react";
import { z } from "zod";

import { TOPIC_SLUGS, type TopicSlug } from "@/lib/topics";

export const HANDBOOK_KINDS = ["concept", "framework", "model"] as const;
export const HANDBOOK_ROUTE_KINDS = ["concepts", "frameworks", "models"] as const;

export type HandbookKind = (typeof HANDBOOK_KINDS)[number];
export type HandbookRouteKind = (typeof HANDBOOK_ROUTE_KINDS)[number];

const routeKindByKind = {
  concept: "concepts",
  framework: "frameworks",
  model: "models",
} as const satisfies Record<HandbookKind, HandbookRouteKind>;

const kindByRouteKind = {
  concepts: "concept",
  frameworks: "framework",
  models: "model",
} as const satisfies Record<HandbookRouteKind, HandbookKind>;

export const HANDBOOK_REQUIRED_HEADINGS = {
  concept: [
    "What is it",
    "Why does it exist",
    "How it works",
    "Architecture",
    "Example",
    "When to use it",
    "When NOT to use it",
    "Tools",
    "Common mistakes",
  ],
  framework: [
    "What is it",
    "What problem does it solve",
    "When to use it",
    "When to avoid it",
    "Alternatives",
    "Architecture",
    "Example",
    "Pros",
    "Cons",
  ],
  model: [
    "What it is",
    "Capabilities",
    "Constraints",
    "When to use it",
    "When not to use it",
  ],
} as const satisfies Record<HandbookKind, readonly string[]>;

const slugSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase kebab-case filename.");

const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Sources must use an http(s) URL.");

function hasValidCalendarDate(value: string): boolean {
  const datePart = value.slice(0, 10);
  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === datePart;
}

const isoDateStringSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/,
    "Use an ISO 8601 date or timestamp.",
  )
  .refine(hasValidCalendarDate, "Date must be valid.");

const handbookDateSchema = z
  .union([z.date(), isoDateStringSchema])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((value) => Number.isFinite(value.getTime()), "Date must be valid.");

const reviewedAtSchema = z
  .union([
    z.date(),
    z
      .string()
      .trim()
      .regex(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/,
        "Use an ISO 8601 timestamp with a timezone.",
      )
      .refine(hasValidCalendarDate, "Review timestamp date must be valid."),
  ])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((value) => Number.isFinite(value.getTime()), "Review timestamp must be valid.");

export const handbookSourceSchema = z
  .object({
    label: z.string().trim().min(1).max(180),
    publisher: z.string().trim().min(1).max(120),
    url: httpUrlSchema,
    publishedAt: handbookDateSchema.optional(),
    accessedAt: handbookDateSchema,
  })
  .strict();

export const handbookModelFactsSchema = z
  .object({
    lab: z.string().trim().min(1).max(120),
    releaseDate: handbookDateSchema,
    accessStatus: z.enum(["public", "limited", "private", "deprecated"]),
    openStatus: z.enum(["open_source", "open_weights", "closed", "not_disclosed"]),
    license: z.string().trim().min(1).max(160).optional(),
    contextWindow: z.number().int().positive().max(100_000_000).optional(),
    modalities: z
      .array(z.enum(["text", "image", "audio", "video"]))
      .min(1)
      .max(4)
      .optional(),
    api: z.boolean().optional(),
    local: z.boolean().optional(),
    toolCalling: z.boolean().optional(),
    structuredOutput: z.boolean().optional(),
    reasoning: z.boolean().optional(),
    fineTuning: z.boolean().optional(),
  })
  .strict()
  .superRefine((facts, ctx) => {
    if (facts.modalities && new Set(facts.modalities).size !== facts.modalities.length) {
      ctx.addIssue({
        code: "custom",
        path: ["modalities"],
        message: "Modalities must be unique.",
      });
    }
  });

export const handbookFrontmatterSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.enum(HANDBOOK_KINDS),
    title: z.string().trim().min(1).max(140),
    summary: z.string().trim().min(1).max(360),
    publishedAt: handbookDateSchema,
    updatedAt: handbookDateSchema,
    draft: z.boolean(),
    origin: z.enum(["human", "ai_assisted", "ai_generated"]),
    sourceStatus: z.enum(["primary", "secondary", "mixed"]),
    testedStatus: z.enum(["not_tested", "tested_once", "replicated"]),
    authenticityStatus: z.enum(["pending", "verified"]),
    reviewedBy: z.string().trim().min(1).max(120).optional(),
    reviewedAt: reviewedAtSchema.optional(),
    myTake: z.string().trim().min(1).max(2_000),
    tags: z.array(z.string().trim().min(1).max(48)).max(12).default([]),
    /** Explicit hub membership only; never infer a topic from prose or tags. */
    topicSlugs: z.array(z.enum(TOPIC_SLUGS)).max(TOPIC_SLUGS.length).default([]),
    sources: z.array(handbookSourceSchema).min(1).max(40),
    modelFacts: handbookModelFactsSchema.optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.updatedAt < entry.publishedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "updatedAt cannot be earlier than publishedAt.",
      });
    }

    if (entry.authenticityStatus === "verified") {
      if (!entry.reviewedBy) {
        ctx.addIssue({
          code: "custom",
          path: ["reviewedBy"],
          message: "Verified handbook entries require a human reviewer.",
        });
      }
      if (!entry.reviewedAt) {
        ctx.addIssue({
          code: "custom",
          path: ["reviewedAt"],
          message: "Verified handbook entries require a review timestamp.",
        });
      } else if (entry.reviewedAt < entry.updatedAt) {
        ctx.addIssue({
          code: "custom",
          path: ["reviewedAt"],
          message: "The final review must be at or after the latest content update.",
        });
      }
    }

    const sourceUrls = entry.sources.map((source) => source.url);
    if (new Set(sourceUrls).size !== sourceUrls.length) {
      ctx.addIssue({
        code: "custom",
        path: ["sources"],
        message: "Each source URL may appear only once.",
      });
    }

    for (const [index, source] of entry.sources.entries()) {
      if (source.publishedAt && source.publishedAt > source.accessedAt) {
        ctx.addIssue({
          code: "custom",
          path: ["sources", index, "accessedAt"],
          message: "A source cannot be accessed before it was published.",
        });
      }
      if (entry.authenticityStatus === "verified" && entry.reviewedAt && source.accessedAt > entry.reviewedAt) {
        ctx.addIssue({
          code: "custom",
          path: ["sources", index, "accessedAt"],
          message: "A verified source must be accessed no later than the final review.",
        });
      }
    }

    if (new Set(entry.tags).size !== entry.tags.length) {
      ctx.addIssue({
        code: "custom",
        path: ["tags"],
        message: "Tags must be unique.",
      });
    }
    if (new Set<TopicSlug>(entry.topicSlugs).size !== entry.topicSlugs.length) {
      ctx.addIssue({
        code: "custom",
        path: ["topicSlugs"],
        message: "Topic slugs must be unique.",
      });
    }
    if (entry.kind === "model" && !entry.modelFacts) {
      ctx.addIssue({
        code: "custom",
        path: ["modelFacts"],
        message: "Model entries require a modelFacts record.",
      });
    }
    if (entry.kind === "model" && entry.modelFacts?.releaseDate && entry.modelFacts.releaseDate > entry.updatedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["modelFacts", "releaseDate"],
        message: "A model release date cannot be later than the entry update date.",
      });
    }
    if (entry.kind !== "model" && entry.modelFacts) {
      ctx.addIssue({
        code: "custom",
        path: ["modelFacts"],
        message: "modelFacts is reserved for model entries.",
      });
    }
  });

export type HandbookFrontmatter = z.infer<typeof handbookFrontmatterSchema>;
export type HandbookSource = z.infer<typeof handbookSourceSchema>;
export type HandbookModelFacts = z.infer<typeof handbookModelFactsSchema>;

export type HandbookEntry = HandbookFrontmatter & {
  slug: string;
  routeKind: HandbookRouteKind;
  body: string;
  readingMinutes: number;
};

export type PublishedHandbookEntry = Omit<
  HandbookEntry,
  "draft" | "origin" | "authenticityStatus" | "reviewedBy" | "reviewedAt"
> & {
  draft: false;
  origin: "human" | "ai_assisted";
  authenticityStatus: "verified";
  reviewedBy: string;
  reviewedAt: Date;
};

const FIRST_PERSON_EXPERIENCE =
  /\b(?:I|we)(?:['’]ve|\s+have|\s+had)?\s+(?:built|ran|run|tested|measured|benchmarked|deployed|shipped|trained|fine-tuned|implemented|instrumented|profiled|debugged|evaluated|observed|used|use|learned|found|discovered|noticed|saw)\b|\bin\s+my\s+experience\b|\bwhat\s+I\s+run\s+now\b|\b(?:my|our)\s+(?:own\s+)?(?:workload|system|setup|cluster|deployment|experiment|benchmark|test|implementation|production|results?)\b/i;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "frontmatter"}: ${issue.message}`)
    .join("; ");
}

function normalizeHeading(value: string): string {
  return value
    .replace(/\s+#+\s*$/, "")
    .replace(/[*_`]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

type HeadingMatch = { label: string; index: number; contentStart: number };

function collectLevelTwoHeadings(body: string): HeadingMatch[] {
  const headings: HeadingMatch[] = [];
  const pattern = /^##(?!#)\s+(.+?)\s*$/gm;
  for (const match of body.matchAll(pattern)) {
    headings.push({
      label: normalizeHeading(match[1]),
      index: match.index,
      contentStart: match.index + match[0].length,
    });
  }
  return headings;
}

/**
 * Enforces a stable scanning contract for every reference type. Extra level-two
 * sections are allowed, but every required section must appear once, in order,
 * and contain actual prose. The personal take is frontmatter-backed and rendered
 * separately, so a second body copy cannot silently drift from the reviewed one.
 */
export function assertValidHandbookBody(
  kind: HandbookKind,
  body: string,
  sourceName: string,
): void {
  const trimmedBody = body.trim();
  if (trimmedBody.length === 0) {
    throw new Error(`${sourceName}: handbook body cannot be empty.`);
  }
  if (/^#(?!#)\s+/m.test(trimmedBody)) {
    throw new Error(`${sourceName}: do not add an H1; the frontmatter title is the page H1.`);
  }

  const headings = collectLevelTwoHeadings(trimmedBody);
  if (headings.some((heading) => heading.label === "my take")) {
    throw new Error(
      `${sourceName}: put My Take in frontmatter, not in the MDX body, so there is one reviewed copy.`,
    );
  }

  let priorIndex = -1;
  for (const requiredHeading of HANDBOOK_REQUIRED_HEADINGS[kind]) {
    const normalized = normalizeHeading(requiredHeading);
    const matchingIndexes = headings
      .map((heading, index) => ({ heading, index }))
      .filter(({ heading }) => heading.label === normalized);

    if (matchingIndexes.length !== 1) {
      throw new Error(
        `${sourceName}: expected exactly one \"## ${requiredHeading}\" section; found ${matchingIndexes.length}.`,
      );
    }

    const [{ heading, index }] = matchingIndexes;
    if (index <= priorIndex) {
      throw new Error(
        `${sourceName}: required sections must follow this order: ${HANDBOOK_REQUIRED_HEADINGS[
          kind
        ].join(" → ")}.`,
      );
    }
    priorIndex = index;

    const nextHeading = headings[index + 1];
    const sectionBody = trimmedBody
      .slice(heading.contentStart, nextHeading?.index ?? trimmedBody.length)
      .replace(/^<!--[^]*?-->\s*/g, "")
      .replace(/^#{3,6}\s+.*$/gm, "")
      .trim();
    if (sectionBody.length === 0) {
      throw new Error(`${sourceName}: \"## ${requiredHeading}\" cannot be empty.`);
    }
  }
}

export function findFabricatedHandbookExperienceClaims(input: {
  title: string;
  summary: string;
  myTake: string;
  body: string;
  origin: HandbookFrontmatter["origin"];
}): string[] {
  if (input.origin !== "ai_generated") return [];

  const claims: string[] = [];
  for (const [field, value] of [
    ["title", input.title],
    ["summary", input.summary],
    ["myTake", input.myTake],
    ["body", input.body],
  ] as const) {
    for (const line of value.split("\n")) {
      const match = line.match(FIRST_PERSON_EXPERIENCE);
      if (match) claims.push(`${field}: \"${match[0]}\"`);
    }
  }
  return claims;
}

export function parseHandbookEntry(input: {
  frontmatter: unknown;
  body: string;
  kind: HandbookKind;
  slug: string;
  sourceName: string;
}): HandbookEntry {
  const slugResult = slugSchema.safeParse(input.slug);
  if (!slugResult.success) {
    throw new Error(`Invalid handbook slug in ${input.sourceName}: ${formatIssues(slugResult.error)}`);
  }

  const parsed = handbookFrontmatterSchema.safeParse(input.frontmatter);
  if (!parsed.success) {
    throw new Error(`Invalid handbook frontmatter in ${input.sourceName}: ${formatIssues(parsed.error)}`);
  }
  if (parsed.data.kind !== input.kind) {
    throw new Error(
      `${input.sourceName}: kind is \"${parsed.data.kind}\" but its directory requires \"${input.kind}\".`,
    );
  }

  assertValidHandbookBody(parsed.data.kind, input.body, input.sourceName);
  const claims = findFabricatedHandbookExperienceClaims({
    ...parsed.data,
    body: input.body,
  });
  if (claims.length > 0) {
    throw new Error(
      `${input.sourceName}: origin ai_generated cannot claim first-person experience (${claims.join(
        "; ",
      )}). Rewrite the claim or have a human take authorship as human / ai_assisted.`,
    );
  }

  const body = input.body.trim();
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  return {
    ...parsed.data,
    slug: slugResult.data,
    routeKind: routeKindByKind[parsed.data.kind],
    body,
    readingMinutes: Math.max(1, Math.round(wordCount / 225)),
  };
}

/** The single public visibility boundary. Never infer publication from `draft` alone. */
export function isPublishedHandbookEntry(
  entry: HandbookEntry,
): entry is PublishedHandbookEntry {
  return (
    !entry.draft &&
    (entry.origin === "human" || entry.origin === "ai_assisted") &&
    entry.authenticityStatus === "verified" &&
    Boolean(entry.reviewedBy?.trim()) &&
    entry.reviewedAt instanceof Date &&
    Number.isFinite(entry.reviewedAt.getTime()) &&
    entry.sources.length > 0 &&
    entry.myTake.trim().length > 0
  );
}

export const HANDBOOK_CONTENT_DIR = join(process.cwd(), "content", "handbook");

function loadHandbookEntries(contentDir: string): HandbookEntry[] {
  const entries: HandbookEntry[] = [];

  for (const kind of HANDBOOK_KINDS) {
    const routeKind = routeKindByKind[kind];
    // This path is intentionally injectable for authoring tools/tests. The
    // production loader below is separately rooted at content/handbook so the
    // deployment tracer includes that directory without tracing the whole repo.
    const directory = join(/* turbopackIgnore: true */ contentDir, routeKind);
    if (!existsSync(/* turbopackIgnore: true */ directory)) continue;

    const files = readdirSync(/* turbopackIgnore: true */ directory, { withFileTypes: true })
      .filter((file) => file.isFile() && file.name.endsWith(".mdx"))
      .map((file) => file.name)
      .sort((left, right) => left.localeCompare(right));

    for (const file of files) {
      const slug = file.replace(/\.mdx$/, "");
      const fullPath = join(/* turbopackIgnore: true */ directory, file);
      const sourceName = relative(process.cwd(), fullPath) || fullPath;
      const raw = readFileSync(/* turbopackIgnore: true */ fullPath, "utf8");
      const { data, content } = matter(raw);
      entries.push(
        parseHandbookEntry({ frontmatter: data, body: content, kind, slug, sourceName }),
      );
    }
  }

  return entries;
}

/** Static-root production path: scoped tracing keeps content files in the bundle. */
function loadDefaultHandbookEntries(): HandbookEntry[] {
  const entries: HandbookEntry[] = [];

  for (const kind of HANDBOOK_KINDS) {
    const routeKind = routeKindByKind[kind];
    const directory = join(HANDBOOK_CONTENT_DIR, routeKind);
    if (!existsSync(directory)) continue;

    const files = readdirSync(directory, { withFileTypes: true })
      .filter((file) => file.isFile() && file.name.endsWith(".mdx"))
      .map((file) => file.name)
      .sort((left, right) => left.localeCompare(right));

    for (const file of files) {
      const slug = file.replace(/\.mdx$/, "");
      const fullPath = join(directory, file);
      const sourceName = relative(process.cwd(), fullPath) || fullPath;
      const raw = readFileSync(fullPath, "utf8");
      const { data, content } = matter(raw);
      entries.push(
        parseHandbookEntry({ frontmatter: data, body: content, kind, slug, sourceName }),
      );
    }
  }

  return entries;
}

function publishedEntries(entries: HandbookEntry[]): PublishedHandbookEntry[] {
  return entries.filter(isPublishedHandbookEntry).sort((left, right) => {
    const byDate = right.updatedAt.getTime() - left.updatedAt.getTime();
    return (
      byDate ||
      left.routeKind.localeCompare(right.routeKind) ||
      left.slug.localeCompare(right.slug)
    );
  });
}

/**
 * Public-only filesystem loader. The optional root exists for deterministic tests
 * and authoring tools; callers rendering the site should use
 * getPublishedHandbookEntries(). `.mdx.example` templates are never considered.
 */
export function loadPublishedHandbookEntries(contentDir: string): PublishedHandbookEntry[] {
  return publishedEntries(loadHandbookEntries(contentDir));
}

const loadPublishedHandbookEntriesForRender = cache(() =>
  publishedEntries(loadDefaultHandbookEntries()),
);

export function getPublishedHandbookEntries(): PublishedHandbookEntry[] {
  return loadPublishedHandbookEntriesForRender();
}

export function isHandbookRouteKind(value: string): value is HandbookRouteKind {
  return (HANDBOOK_ROUTE_KINDS as readonly string[]).includes(value);
}

export function getPublishedHandbookEntry(
  routeKind: string,
  slug: string,
): PublishedHandbookEntry | null {
  if (!isHandbookRouteKind(routeKind) || !slugSchema.safeParse(slug).success) return null;
  const expectedKind = kindByRouteKind[routeKind];
  return (
    getPublishedHandbookEntries().find(
      (entry) => entry.kind === expectedKind && entry.slug === slug,
    ) ?? null
  );
}

export function getHandbookStaticParams(): Array<{
  kind: HandbookRouteKind;
  slug: string;
}> {
  return getPublishedHandbookEntries().map((entry) => ({
    kind: entry.routeKind,
    slug: entry.slug,
  }));
}
