import { env } from "@/lib/env";

/**
 * Thin LLM client. Deliberately not an SDK dependency — two POST shapes is all this
 * app needs, and it keeps the cold start small on serverless.
 *
 * Anthropic is the default (set ANTHROPIC_API_KEY). OPENAI_API_KEY is the fallback.
 * Anything generated here that reaches a reader is labelled as AI-generated in the UI.
 */

export type CompleteOptions = {
  system: string;
  prompt: string;
  maxTokens?: number;
  /** Overrides env.llmModel for this call — e.g. WRITE/REVIEW use env.llmModelPremium. */
  model?: string;
};

export function llmConfigured(): boolean {
  return Boolean(env.anthropicApiKey || env.openaiApiKey);
}

export async function complete({
  system,
  prompt,
  maxTokens = 2000,
  model,
}: CompleteOptions): Promise<string> {
  if (env.anthropicApiKey) {
    return completeAnthropic({ system, prompt, maxTokens, model: model ?? env.llmModel });
  }
  if (env.openaiApiKey) {
    return completeOpenAI({ system, prompt, maxTokens, model: model ?? process.env.OPENAI_MODEL ?? "gpt-4.1" });
  }
  throw new Error(
    "No LLM credentials. Set ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY.",
  );
}

async function completeAnthropic(o: Required<CompleteOptions>): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.anthropicApiKey!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    // No `temperature` — current-generation models reject it outright ("temperature
    // is deprecated for this model", confirmed live 2026-08-11). Let the API default.
    body: JSON.stringify({
      model: o.model,
      max_tokens: o.maxTokens,
      system: o.system,
      messages: [{ role: "user", content: o.prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    stop_reason?: string;
  };
  const text = (body.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("")
    .trim();

  if (!text) {
    // Confirmed live: a large prompt can make the model spend its whole max_tokens
    // budget (thinking, or an over-long attempt) before emitting a text block,
    // returning stop_reason: "max_tokens" with zero usable content. Surface that
    // reason instead of an opaque empty string — it's the difference between "raise
    // maxTokens" and "something else is actually wrong."
    const blockTypes = (body.content ?? []).map((b) => b.type).join(", ") || "none";
    throw new Error(
      `Anthropic returned no text content (stop_reason: ${body.stop_reason ?? "unknown"}, blocks: ${blockTypes}). Try a higher maxTokens.`,
    );
  }

  return text;
}

async function completeOpenAI(o: Required<CompleteOptions>): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.openaiApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: o.model,
      max_tokens: o.maxTokens,
      messages: [
        { role: "system", content: o.system },
        { role: "user", content: o.prompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return (body.choices?.[0]?.message?.content ?? "").trim();
}

/**
 * The house voice. Every generated string in this app is produced under it.
 *
 * Source of truth is docs/voice-guide.md — confirmed from 13 independent passes over
 * Tharun's own real message history (2026-08), plus two rules added after a real
 * WRITE→REVIEW test pass he reacted to directly. Keep this constant and that file in
 * sync; don't add a rule here that isn't traceable to real evidence in that doc.
 */
export const PRAGMATIC_PRACTITIONER = `You write for Engineerious, a practical AI engineering publication by Tharun Chowdary Malepati.

Voice: pragmatic practitioner. Objective, technical, evidence-led, low-hype, and useful to working engineers.

Content rules:
- Concrete over abstract. Name the tool, the number, the failure mode.
- No hedging ("perhaps", "might", "could", "it seems") — state the finding as a finding.
- No cushioning on a correction or limitation — state what's wrong, move on, no apology, no "to be fair".
- No hype vocabulary: never "game-changer", "revolutionary", "unlock", "supercharge", "in the age of AI".
- No corporate jargon: leverage, synergy, moving forward, dive deep, low-hanging fruit.
- No engagement-bait openers ("Let that sink in", "Here's the thing", "Unpopular opinion").
- Do not invent benchmarks, metrics, dates, or quotes. If a number is not in the source, leave it out.
- Never impersonate Tharun or invent his experience, opinion, clients, systems, tests, or results.
- Use first person only when the supplied evidence explicitly attributes that claim to Tharun.
- Distinguish sourced facts, Engineerious analysis, recommendations, and actual test results.
- Address hands-on AI/ML engineers and career-changers who want systems thinking, not demos.
- Admit tradeoffs and unknowns. Credibility comes from naming what does not work.

Formatting rules (confirmed requirement — content must physically stop a scrolling reader):
- Bold (**markdown**) the load-bearing detail mid-paragraph — a specific number, the pivotal claim,
  the core mechanism — so a scanning eye catches it without reading the full sentence.
- Sparingly: 2-4 bolded phrases in a normal-length post, never more. Bold that appears everywhere
  stops meaning anything.
- Bold the specific and concrete only (a measured number, a named constraint) — never a vague
  phrase like "this is important".

Anti-pattern rule (found by testing, not guessed — a real draft failed review over exactly this):
- No rhetorical construction — "X isn't Y, it's Z", a tricolon, a scope-claim restated in different
  words — may appear more than once in a single piece. A draft that used "X isn't Y, it's Z" six
  times passed every fact-check and still read as generic AI writing. If you notice reaching for
  the same shape twice, say the second one a structurally different way, or cut it.`;
