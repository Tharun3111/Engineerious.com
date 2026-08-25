import { createHash } from "node:crypto";

import { z } from "zod";

import { httpUrlSchema } from "@/lib/editorial-safety";

const requiredText = z.string().trim().min(1);
const sourceUrlsSchema = z.array(httpUrlSchema).min(1);

export const dailyStoryCategorySchema = z.enum([
  "models",
  "agents",
  "research",
  "open_source",
  "frameworks",
  "infrastructure",
  "business",
  "developer_tools",
]);

export type DailyStoryCategory = z.infer<typeof dailyStoryCategorySchema>;

export const dailyStorySchema = z
  .object({
    id: requiredText,
    category: dailyStoryCategorySchema,
    sourceLabel: requiredText,
    headline: requiredText,
    whatHappened: requiredText,
    whyItMatters: requiredText,
    forEngineers: requiredText,
    sourceUrls: sourceUrlsSchema,
  })
  .strict();

const oneThingToLearnSchema = z
  .object({
    title: requiredText,
    explanation: requiredText,
    sourceUrls: sourceUrlsSchema,
  })
  .strict();

const modelToKnowSchema = z
  .object({
    name: requiredText,
    whatItDoes: requiredText,
    modelSize: requiredText.nullable(),
    contextWindow: requiredText.nullable(),
    license: requiredText.nullable(),
    whyInteresting: requiredText,
    sourceUrls: sourceUrlsSchema,
  })
  .strict();

const toolOfTheDaySchema = z
  .object({
    name: requiredText,
    whatItIs: requiredText,
    whenToUse: requiredText,
    sourceUrls: sourceUrlsSchema,
  })
  .strict();

const paperWorthKnowingSchema = z
  .object({
    title: requiredText,
    takeaway: requiredText,
    sourceUrls: sourceUrlsSchema,
  })
  .strict();

export const dailyDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Expected a real calendar date");

const dailyBriefShape = {
  schemaVersion: z.literal(1),
  date: dailyDateSchema,
  title: requiredText,
  summary: requiredText,
  stories: z.array(dailyStorySchema).min(1).max(10),
  oneThingToLearn: oneThingToLearnSchema.nullable(),
  modelToKnow: modelToKnowSchema.nullable(),
  toolOfTheDay: toolOfTheDaySchema.nullable(),
  paperWorthKnowing: paperWorthKnowingSchema.nullable(),
} as const;

function requireUniqueStoryIds(
  brief: { stories: Array<{ id: string }> },
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  brief.stories.forEach((story, index) => {
    if (seen.has(story.id)) {
      context.addIssue({
        code: "custom",
        message: "Story IDs must be unique within a Daily Brief",
        path: ["stories", index, "id"],
      });
    }
    seen.add(story.id);
  });
}

/** Mutable admin working copy. myTake is deliberately allowed to be empty. */
export const dailyBriefDraftSchema = z
  .object({ ...dailyBriefShape, myTake: z.string() })
  .strict()
  .superRefine(requireUniqueStoryIds);

/**
 * The model is never allowed to impersonate Tharun. Generation must leave this
 * field exactly empty; only the human editor can add a personal take later.
 */
export const generatedDailyBriefSchema = z
  .object({ ...dailyBriefShape, myTake: z.literal("") })
  .strict()
  .superRefine(requireUniqueStoryIds);

/** A public snapshot is incomplete until a human has supplied a personal take. */
export const publishedDailyBriefSchema = z
  .object({ ...dailyBriefShape, myTake: requiredText })
  .strict()
  .superRefine(requireUniqueStoryIds);

export type DailyStory = z.infer<typeof dailyStorySchema>;
export type DailyBriefDraft = z.infer<typeof dailyBriefDraftSchema>;
export type GeneratedDailyBrief = z.infer<typeof generatedDailyBriefSchema>;
export type PublishedDailyBrief = z.infer<typeof publishedDailyBriefSchema>;

function parseWithMessage<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`${label} failed schema validation: ${JSON.stringify(result.error.issues)}`);
  }
  return result.data;
}

export function parseDailyBriefDraft(value: unknown): DailyBriefDraft {
  return parseWithMessage(dailyBriefDraftSchema, value, "Daily Brief draft");
}

export function parseGeneratedDailyBrief(value: unknown): GeneratedDailyBrief {
  return parseWithMessage(generatedDailyBriefSchema, value, "Generated Daily Brief");
}

export function parsePublishedDailyBrief(value: unknown): PublishedDailyBrief {
  return parseWithMessage(publishedDailyBriefSchema, value, "Published Daily Brief");
}

function stableJson(value: unknown): string {
  if (value === undefined) {
    throw new Error("Cannot hash undefined values; persist explicit nulls instead");
  }
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Hash all reviewed facts and structure while keeping the personal take separate. */
export function factualContentHash(value: DailyBriefDraft): string {
  const parsed = parseDailyBriefDraft(value);
  const factualContent = Object.fromEntries(
    Object.entries(parsed).filter(([key]) => key !== "myTake"),
  );
  return sha256(stableJson(factualContent));
}

/** Alias that reads clearly at Daily-specific call sites. */
export const hashDailyFactualContent = factualContentHash;

/** Newline and edge whitespace normalization avoids platform-only hash changes. */
export function myTakeContentHash(myTake: string): string {
  return sha256(myTake.replace(/\r\n?/g, "\n").trim());
}

export const hashMyTake = myTakeContentHash;

/**
 * Stable ID for generation/recovery. Reordering a finding's source URLs does not
 * create a new story, while a different day or headline does.
 */
export function createDailyStoryId(input: {
  date: string;
  headline: string;
  sourceUrls: string[];
}): string {
  const identity = stableJson({
    date: input.date,
    headline: input.headline.normalize("NFKC").trim().toLocaleLowerCase("en-US"),
    sourceUrls: [...input.sourceUrls].sort(),
  });
  return `story-${sha256(identity).slice(0, 16)}`;
}

/** Every citation in a payload, deduplicated in first-appearance order. */
export function collectDailySourceUrls(brief: DailyBriefDraft): string[] {
  const parsed = parseDailyBriefDraft(brief);
  const urls = [
    ...parsed.stories.flatMap((story) => story.sourceUrls),
    ...(parsed.oneThingToLearn?.sourceUrls ?? []),
    ...(parsed.modelToKnow?.sourceUrls ?? []),
    ...(parsed.toolOfTheDay?.sourceUrls ?? []),
    ...(parsed.paperWorthKnowing?.sourceUrls ?? []),
  ];
  return [...new Set(urls)];
}

export type DailyQuickSheet = {
  label: "60-second view";
  storyCount: number;
  sourceCount: number;
  biggestStory: DailyQuickSheetSlot;
  model: DailyQuickSheetSlot | null;
  openSource: DailyQuickSheetSlot | null;
  framework: DailyQuickSheetSlot | null;
  research: DailyQuickSheetSlot | null;
  worthLearning: DailyQuickSheetSlot | null;
  myTake: DailyQuickSheetSlot;
};

export type DailyQuickSheetSlot = {
  label: string;
  title: string;
  detail: string;
  sourceUrl: string | null;
};

function storySlot(label: string, story: DailyStory): DailyQuickSheetSlot {
  return {
    label,
    title: story.headline,
    detail: story.forEngineers,
    sourceUrl: story.sourceUrls[0],
  };
}

/** A compact view computed from the public snapshot, never a second stored draft. */
export function deriveDailyQuickSheet(brief: PublishedDailyBrief): DailyQuickSheet {
  const parsed = parsePublishedDailyBrief(brief);
  const firstStory = (category: DailyStoryCategory) =>
    parsed.stories.find((story) => story.category === category);
  const modelStory = firstStory("models");
  const openSourceStory = firstStory("open_source");
  const frameworkStory = firstStory("frameworks");
  const researchStory = firstStory("research");

  return {
    label: "60-second view",
    storyCount: parsed.stories.length,
    sourceCount: collectDailySourceUrls(parsed).length,
    biggestStory: storySlot("Biggest story", parsed.stories[0]),
    model: modelStory
      ? storySlot("Model", modelStory)
      : parsed.modelToKnow
        ? {
            label: "Model",
            title: parsed.modelToKnow.name,
            detail: parsed.modelToKnow.whyInteresting,
            sourceUrl: parsed.modelToKnow.sourceUrls[0],
          }
        : null,
    openSource: openSourceStory ? storySlot("Open source", openSourceStory) : null,
    framework: frameworkStory ? storySlot("Framework", frameworkStory) : null,
    research: researchStory
      ? storySlot("Research", researchStory)
      : parsed.paperWorthKnowing
        ? {
            label: "Research",
            title: parsed.paperWorthKnowing.title,
            detail: parsed.paperWorthKnowing.takeaway,
            sourceUrl: parsed.paperWorthKnowing.sourceUrls[0],
          }
        : null,
    worthLearning: parsed.oneThingToLearn
      ? {
          label: "Worth learning",
          title: parsed.oneThingToLearn.title,
          detail: parsed.oneThingToLearn.explanation,
          sourceUrl: parsed.oneThingToLearn.sourceUrls[0],
        }
      : null,
    myTake: {
      label: "Tharun's take",
      title: "What I think this changes",
      detail: parsed.myTake,
      sourceUrl: null,
    },
  };
}
