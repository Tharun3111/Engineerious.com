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
  temperature?: number;
};

export function llmConfigured(): boolean {
  return Boolean(env.anthropicApiKey || env.openaiApiKey);
}

export async function complete({
  system,
  prompt,
  maxTokens = 2000,
  temperature = 0.7,
}: CompleteOptions): Promise<string> {
  if (env.anthropicApiKey) {
    return completeAnthropic({ system, prompt, maxTokens, temperature });
  }
  if (env.openaiApiKey) {
    return completeOpenAI({ system, prompt, maxTokens, temperature });
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
    body: JSON.stringify({
      model: env.llmModel,
      max_tokens: o.maxTokens,
      temperature: o.temperature,
      system: o.system,
      messages: [{ role: "user", content: o.prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return (body.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("")
    .trim();
}

async function completeOpenAI(o: Required<CompleteOptions>): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.openaiApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1",
      max_tokens: o.maxTokens,
      temperature: o.temperature,
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

/** The house voice. Every generated string in this app is produced under it. */
export const PRAGMATIC_PRACTITIONER = `You write as Tharun Chowdary Malepati, a generative AI engineer publishing under the name Engineerious.

Voice: pragmatic practitioner. Objective, technical, evidence-led, low-hype, mentor tone — "I'm building this too and I'll show you the real edges."

Rules:
- Concrete over abstract. Name the tool, the number, the failure mode.
- No hype vocabulary: never "game-changer", "revolutionary", "unlock", "supercharge", "in the age of AI".
- No engagement-bait openers ("Let that sink in", "Here's the thing", "Unpopular opinion").
- Do not invent benchmarks, metrics, dates, or quotes. If a number is not in the source, leave it out.
- Address hands-on AI/ML engineers and career-changers who want systems thinking, not demos.
- Admit tradeoffs and unknowns. Credibility comes from naming what does not work.`;
