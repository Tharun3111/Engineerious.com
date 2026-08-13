import { z } from "zod";

import { env } from "@/lib/env";
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

const reviewSchema = z.object({
  groundingViolations: z.array(z.object({ quote: z.string(), issue: z.string() })),
  voiceViolations: z.array(z.object({ quote: z.string(), issue: z.string() })),
  overallVerdict: z.string(),
  readsAsGenericAiContent: z.boolean(),
});

export type ReviewReport = z.infer<typeof reviewSchema>;

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
