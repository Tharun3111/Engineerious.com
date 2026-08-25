import { z } from "zod";

import { env } from "@/lib/env";
import { assertNoFabricatedExperience } from "@/lib/content/frontmatter";
import { collectDailySourceUrls, type DailyBriefDraft } from "@/lib/daily-brief";
import { assertUrlsAllowed } from "@/lib/editorial-safety";
import { complete } from "@/lib/llm";
import type { Finding } from "@/lib/research";
import type { WriteOutput } from "@/lib/write";

/**
 * REVIEW stage (Sonnet 5) — adversarial check of WRITE's output against RESEARCH's
 * source material and the confirmed voice guide. This is the exact pattern already
 * validated live (2026-08-11, see docs/voice-guide.md's calibration example): it
 * caught real fabricated specifics and a repeated rhetorical construction that every
 * individual sentence had passed. It flags; it does not silently edit — the human
 * in /admin decides what to do with the flags.
 */

export const reviewSchema = z.object({
  groundingViolations: z.array(z.object({ quote: z.string(), issue: z.string() })),
  voiceViolations: z.array(z.object({ quote: z.string(), issue: z.string() })),
  overallVerdict: z.string(),
  readsAsGenericAiContent: z.boolean(),
});

export type ReviewReport = z.infer<typeof reviewSchema>;

/**
 * Deterministic publication gate over REVIEW's structured output. REVIEW may flag,
 * but it cannot clear its own flags by moving a digest to another status; only a
 * clean report is eligible for the separate human approval action.
 */
export function reviewBlockingIssues(report: unknown): string[] {
  const parsed = reviewSchema.safeParse(report);
  if (!parsed.success) return ["Review report is missing or invalid."];

  const issues: string[] = [];
  const grounding = parsed.data.groundingViolations.length;
  const voice = parsed.data.voiceViolations.length;
  if (grounding > 0) {
    issues.push(`${grounding} grounding violation${grounding === 1 ? "" : "s"} remain${grounding === 1 ? "s" : ""} unresolved.`);
  }
  if (voice > 0) {
    issues.push(`${voice} voice violation${voice === 1 ? "" : "s"} remain${voice === 1 ? "s" : ""} unresolved.`);
  }
  if (parsed.data.readsAsGenericAiContent) {
    issues.push("The draft is still flagged as generic AI content.");
  }
  return issues;
}

const SYSTEM = `You are the REVIEW stage of the daily Engineerious pipeline — an adversarial skeptic
checking a draft before a human decides whether to publish it. Your job is to find problems, not
to be agreeable.

Check specifically:
- CLAIM GROUNDING: does every number, mechanism, and claim in the draft trace to the source
  findings it must be grounded in? Quote any sentence that states something not supported by the
  findings — including plausible-sounding specifics (a tool pairing, a causal explanation) that
  the findings don't actually state. This applies EQUALLY to the body, the KEY FACTS list, and the
  DIAGRAM's step details below — a key fact or a diagram step is exactly as capable of stating an
  ungrounded claim as a body sentence, and gets the same scrutiny, not a lighter pass because it's
  short. For the diagram specifically: does the sequence/comparison it depicts actually match what
  the findings describe, or does it impose an order, causality, or contrast the findings don't
  support?
- VOICE VIOLATIONS: quote any sentence that hedges ("perhaps", "might"), cushions a correction,
  uses corporate jargon, or — the one real failure mode found by testing this exact pipeline —
  reuses the same rhetorical construction ("X isn't Y, it's Z", a restated scope claim) more than
  once across the piece. One instance is fine; a second instance of the same shape is the
  violation, even if neither sentence is individually wrong.
- Whether this genuinely reads as distinct, plainly-stated writing or as generic AI-blog cadence.

Output ONLY valid JSON matching this shape, nothing else, no markdown fences:
{"groundingViolations":[{"quote":string,"issue":string}],"voiceViolations":[{"quote":string,"issue":string}],"overallVerdict":string,"readsAsGenericAiContent":boolean}`;

function formatFindings(findings: Finding[]): string {
  return findings
    .map((f, i) => `${i + 1}. ${f.title}\n   ${f.summary}\n   Sources: ${f.sourceUrls.join(", ")}`)
    .join("\n\n");
}

export async function reviewDaily(input: { draft: WriteOutput; findings: Finding[] }): Promise<ReviewReport> {
  const keyFactsBlock =
    input.draft.keyFacts.length > 0
      ? `\n=== KEY FACTS (check each one against the findings, same as body sentences) ===\n${input.draft.keyFacts.map((f) => `- ${f}`).join("\n")}\n`
      : "";

  const diagramBlock = input.draft.diagram
    ? `\n=== DIAGRAM (${input.draft.diagram.type}): ${input.draft.diagram.title} ===\n${input.draft.diagram.steps.map((s, i) => `${i + 1}. ${s.label} — ${s.detail}`).join("\n")}\n`
    : "";

  const prompt = `=== DRAFT ===
Title: ${input.draft.title}
Dek: ${input.draft.dek}

${input.draft.body}
${keyFactsBlock}${diagramBlock}
=== REQUIRED SOURCE FINDINGS (nothing outside this list may be stated as fact) ===
${formatFindings(input.findings)}

Review the draft now.`;

  const raw = await complete({ system: SYSTEM, prompt, maxTokens: 6000, model: env.llmModelPremium });

  const jsonText = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`REVIEW stage returned invalid JSON: ${(error as Error).message}\n---\n${raw.slice(0, 500)}`);
  }

  const result = reviewSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`REVIEW stage output failed schema validation: ${JSON.stringify(result.error.issues)}`);
  }

  return result.data;
}

const DAILY_BRIEF_REVIEW_SYSTEM = `You are the adversarial REVIEW stage for an Engineerious Daily
intelligence sheet. Check the machine-authored factual fields before a human editor sees them.
Your job is to surface problems, never to approve or publish content.

Check specifically:
- CLAIM GROUNDING: every number, name, mechanism, capability, causal statement, recommendation,
  and engineering implication must trace to the supplied findings. Quote unsupported text exactly.
- MODULE GROUNDING: apply the same standard to every story and to the learning, model, tool, and
  paper modules. Short fields are not exempt from review.
- VOICE: flag hype, corporate jargon, vague filler, repeated rhetorical templates, or prose that
  presents speculation as fact.
- GENERIC CADENCE: say whether the machine-authored brief reads like interchangeable AI-news copy.

The human-only "My Take" field is deliberately absent from the review material. Do not flag its
absence and do not infer or evaluate Tharun's opinion. A separate explicit confirmation gate owns
that field.

Output ONLY valid JSON matching this shape, nothing else, no markdown fences:
{"groundingViolations":[{"quote":string,"issue":string}],"voiceViolations":[{"quote":string,"issue":string}],"overallVerdict":string,"readsAsGenericAiContent":boolean}`;

function formatDailyBriefForReview(draft: DailyBriefDraft): string {
  const stories = draft.stories
    .map(
      (story, index) => `### STORY ${index + 1} [${story.category}] — ${story.sourceLabel}
Headline: ${story.headline}
What happened: ${story.whatHappened}
Why it matters: ${story.whyItMatters}
For engineers: ${story.forEngineers}
Sources: ${story.sourceUrls.join(", ")}`,
    )
    .join("\n\n");

  const oneThing = draft.oneThingToLearn
    ? `### ONE THING TO LEARN
Title: ${draft.oneThingToLearn.title}
Explanation: ${draft.oneThingToLearn.explanation}
Sources: ${draft.oneThingToLearn.sourceUrls.join(", ")}`
    : "";
  const model = draft.modelToKnow
    ? `### MODEL TO KNOW
Name: ${draft.modelToKnow.name}
What it does: ${draft.modelToKnow.whatItDoes}
${draft.modelToKnow.modelSize ? `Model size: ${draft.modelToKnow.modelSize}\n` : ""}${draft.modelToKnow.contextWindow ? `Context window: ${draft.modelToKnow.contextWindow}\n` : ""}${draft.modelToKnow.license ? `License: ${draft.modelToKnow.license}\n` : ""}Why interesting: ${draft.modelToKnow.whyInteresting}
Sources: ${draft.modelToKnow.sourceUrls.join(", ")}`
    : "";
  const tool = draft.toolOfTheDay
    ? `### TOOL OF THE DAY
Name: ${draft.toolOfTheDay.name}
What it is: ${draft.toolOfTheDay.whatItIs}
When to use: ${draft.toolOfTheDay.whenToUse}
Sources: ${draft.toolOfTheDay.sourceUrls.join(", ")}`
    : "";
  const paper = draft.paperWorthKnowing
    ? `### PAPER WORTH KNOWING
Title: ${draft.paperWorthKnowing.title}
Takeaway: ${draft.paperWorthKnowing.takeaway}
Sources: ${draft.paperWorthKnowing.sourceUrls.join(", ")}`
    : "";

  return [`Date: ${draft.date}\nTitle: ${draft.title}\nSummary: ${draft.summary}`, stories, oneThing, model, tool, paper]
    .filter(Boolean)
    .join("\n\n");
}

/** Reviews only machine-authored factual fields. `myTake` never enters the prompt. */
export async function reviewDailyBrief(input: {
  draft: DailyBriefDraft;
  findings: Finding[];
}): Promise<ReviewReport> {
  assertNoFabricatedExperience(
    { title: input.draft.title, dek: input.draft.summary, origin: "ai_generated" },
    JSON.stringify({ ...input.draft, myTake: "" }),
    `Daily REVIEW input for ${input.draft.date}`,
  );
  assertUrlsAllowed(
    collectDailySourceUrls(input.draft),
    input.findings.flatMap((finding) => finding.sourceUrls),
    "Daily REVIEW sources",
  );

  const prompt = `=== MACHINE-AUTHORED DAILY BRIEF (MY TAKE EXCLUDED) ===
${formatDailyBriefForReview(input.draft)}

=== REQUIRED SOURCE FINDINGS (nothing outside this list may be stated as fact) ===
${formatFindings(input.findings)}

Review the factual Daily brief now.`;

  const raw = await complete({
    system: DAILY_BRIEF_REVIEW_SYSTEM,
    prompt,
    maxTokens: 6000,
    model: env.llmModelPremium,
  });
  const jsonText = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      `Daily REVIEW stage returned invalid JSON: ${(error as Error).message}\n---\n${raw.slice(0, 500)}`,
    );
  }

  const result = reviewSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Daily REVIEW stage output failed schema validation: ${JSON.stringify(result.error.issues)}`,
    );
  }

  return result.data;
}
