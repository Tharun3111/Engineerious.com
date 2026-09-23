import { z } from "zod";

import { complete, PRAGMATIC_PRACTITIONER } from "@/lib/llm";
import {
  collectDailySourceUrls,
  createDailyStoryId,
  generatedDailyBriefSchema,
  parseGeneratedDailyBrief,
  type GeneratedDailyBrief,
} from "@/lib/daily-brief";
import { assertNoFabricatedExperience } from "@/lib/content/frontmatter";
import { PILLAR_SLUGS, type PillarSlug } from "@/lib/pillars";
import type { Finding } from "@/lib/research";
import type { StockQuote } from "@/lib/stocks";
import { env } from "@/lib/env";
import { assertUrlsAllowed, httpUrlSchema } from "@/lib/editorial-safety";

/**
 * Legacy WRITE stage (Sonnet 5) — turns RESEARCH's grounded findings into a post and
 * newsletter. Kept only so a pre-structured-daily checkpoint can finish REVIEW.
 * Deliberately split: the LLM produces prose and editorial judgment
 * (title, body, which highlights matter); deterministic code renders the actual
 * email HTML and the stock table. An LLM asked to also emit safe, well-formed
 * email-client HTML is a second failure surface for no benefit — the data underneath
 * the email is either already-grounded findings or raw stock numbers, neither of
 * which needs a model's judgment to render into a table.
 */

const writeOutputSchema = z.object({
  title: z.string().min(1),
  dek: z.string().min(1),
  /** Markdown body, following PRAGMATIC_PRACTITIONER's voice + formatting rules. */
  body: z.string().min(1),
  /** One or two sentences, skimmable before the fold — rendered by the <TLDR> component. */
  tldr: z.string().min(1),
  /**
   * 2-5 standalone facts for the <KeyFacts> callout — each grounded in a real finding,
   * same discipline as emailHighlights. Empty array is valid (component renders nothing).
   */
  keyFacts: z.array(z.string().min(1)).max(5),
  /**
   * Ticker symbols from STOCK CONTEXT that are genuinely relevant to today's piece —
   * not every notable mover, only ones the piece actually discusses. `.max(6)` catches
   * an unbounded list; it does NOT prove each symbol was one of the ones actually
   * supplied — the caller (daily-write route) cross-checks that deterministically
   * against the real day's stockQuotes, same discipline as emailHighlights' URLs.
   */
  relevantTickers: z.array(z.string().min(1)).max(6),
  /**
   * Structured spec, NOT raw mermaid text — only when a finding literally describes a
   * process/sequence or a before/after comparison. Omit entirely on days without one;
   * most days won't have one. Each step needs a real label/detail so REVIEW can quote
   * against it, same grounding discipline as everything else.
   */
  diagram: z
    .object({
      type: z.enum(["sequence", "comparison"]),
      title: z.string().min(1),
      steps: z.array(z.object({ label: z.string().min(1), detail: z.string().min(1) })).min(2).max(6),
    })
    .optional(),
  tags: z.array(z.string()).max(6),
  pillarSlug: z.enum(PILLAR_SLUGS as unknown as [PillarSlug, ...PillarSlug[]]).nullable(),
  /**
   * 3-6 items for the email's highlights list — each grounded in a real finding.
   * `.url()` catches a malformed value; it does NOT prove the URL is one of the
   * findings actually supplied — the caller (daily-write route) cross-checks that
   * deterministically against the real finding sourceUrls, since that's an exact
   * match a database query does perfectly and an LLM review pass might not catch.
   */
  emailHighlights: z
    .array(z.object({ title: z.string().min(1), oneLiner: z.string().min(1), url: httpUrlSchema }))
    .min(1)
    .max(6),
});

export type WriteOutput = z.infer<typeof writeOutputSchema>;

const SYSTEM = `${PRAGMATIC_PRACTITIONER}

You are the WRITE stage of the daily Engineerious pipeline. You receive today's RESEARCH
findings — already deduped, ranked, and source-attributed — and turn them into the day's post.

Rules, no exceptions:
- Every claim in the body must trace to a finding you were given. Do not add facts, numbers, or
  context the findings don't contain, even if you're confident they're true.
- Write ONE coherent piece that synthesizes the day's findings — not a list of separate blurbs.
  Find the actual throughline (what does today mean for someone building with this stuff), lead
  with it, then work through the findings that support it. Skip findings that don't fit a
  coherent piece over forcing all of them in.
- Structure the body with markdown ## subheadings — 2-4 of them, each a specific claim or insight
  in its own words ("Why the retry logic masked the real bug", not a generic label like "Details"
  or "Background"). A single unbroken wall of prose reads thinner than it is; named sections make
  the actual structure of the argument visible. Each section should stand on its own if someone
  only reads that one part.
- Every section should carry at least one concrete number, name, or specific detail from the
  findings — not just the takeaway in prose, the actual evidence (a percentage, a version number,
  a benchmark score, a dollar figure). Findings that don't have concrete specifics to offer are
  weaker material for a section of their own.
- End the body with ONE short, standalone sentence that states the piece's actual thesis — the
  single thing a reader should walk away thinking, phrased plainly, not a recap of what was
  already said. This is the line someone would quote if they shared the post.
- 700-1200 words for the body.
- emailHighlights must be a SUBSET of the same findings, not new content — 3-6 of the strongest,
  each a real one-liner (not a copy of the finding's summary verbatim, but not inventing anything
  beyond it either).
- tldr: one or two sentences a reader can grasp in 5 seconds before deciding to read on. Grounded
  in the same findings as body — not a generic teaser, an actual compressed version of the piece.
- keyFacts: 2-5 standalone, skimmable facts from today's findings — each one a complete thought on
  its own (a reader who only reads this list should still have real information). Grounded in the
  findings you were given, same rule as everything else. If nothing in today's findings reduces
  cleanly to standalone facts, return an empty array — do not pad it with restated body sentences.
- relevantTickers: symbols from STOCK CONTEXT that today's piece actually discusses or draws a real
  connection to — not a copy of every notable mover. Empty array is normal and common: only include
  a ticker when the piece genuinely talks about it, never to "add some stock content."
- diagram: OMIT this field entirely unless a finding literally describes a multi-step process, a
  sequence of events, or a clear before/after comparison — most days have neither, and forcing a
  diagram where the findings don't support one is worse than no diagram. When you do include one:
  type is "sequence" for a process/timeline or "comparison" for before/after or option-vs-option;
  2-6 steps; each step's label is short (2-5 words) and its detail is one grounded sentence, quotable
  against the findings the same way body sentences are.
- pillarSlug: pick "eval-first", "mcp", or "rag-mlops" only if today's piece is genuinely centered
  on that pillar's territory. null is correct and common — most days won't fit one pillar cleanly.
- Output ONLY valid JSON matching this shape, nothing else, no markdown fences:
{"title":string,"dek":string,"body":string,"tldr":string,"keyFacts":string[],"relevantTickers":string[],"diagram":{"type":"sequence"|"comparison","title":string,"steps":[{"label":string,"detail":string}]}|omit,"tags":string[],"pillarSlug":"eval-first"|"mcp"|"rag-mlops"|null,"emailHighlights":[{"title":string,"oneLiner":string,"url":string}]}`;

function formatFindings(findings: Finding[]): string {
  return findings
    .map(
      (f, i) =>
        `${i + 1}. [${f.category}/${f.novelty}] ${f.title}\n   ${f.summary}\n   Sources: ${f.sourceUrls.join(", ")}`,
    )
    .join("\n\n");
}

function formatStockContext(quotes: StockQuote[]): string {
  const notable = quotes.filter((q) => q.percentChange !== null && Math.abs(q.percentChange) >= 2);
  if (notable.length === 0) return "(no notable stock moves today — do not mention stocks)";
  return notable
    .map((q) => `${q.ticker}: ${q.percentChange!.toFixed(1)}%${q.headline ? ` ("${q.headline}")` : ""}`)
    .join("; ");
}

export async function writeDaily(input: {
  findings: Finding[];
  stockQuotes: StockQuote[];
  date: string;
}): Promise<WriteOutput> {
  const prompt = `=== TODAY'S RESEARCH FINDINGS (${input.date}) ===
${formatFindings(input.findings)}

=== STOCK CONTEXT (for correlation only if a finding genuinely relates — never force it) ===
${formatStockContext(input.stockQuotes)}

Write today's piece now.`;

  const raw = await complete({ system: SYSTEM, prompt, maxTokens: 8000, model: env.llmModelPremium });

  const jsonText = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`WRITE stage returned invalid JSON: ${(error as Error).message}\n---\n${raw.slice(0, 500)}`);
  }

  const result = writeOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`WRITE stage output failed schema validation: ${JSON.stringify(result.error.issues)}`);
  }

  return result.data;
}

const DAILY_BRIEF_SYSTEM = `${PRAGMATIC_PRACTITIONER}

You are the machine-authored WRITE stage for Engineerious Daily. Turn the supplied, already
ranked research findings into a concise structured intelligence sheet. This is not a blog post
and it is not an email.

Rules, no exceptions:
- Every factual statement must trace directly to a supplied finding. Do not add remembered facts,
  model specifications, dates, prices, benchmarks, mechanisms, or context.
- Every sourceUrls value must be copied verbatim from a supplied finding. Never create, rewrite,
  normalize, or shorten a URL.
- Select 1-10 genuinely important stories. Merge overlapping findings rather than repeating them.
- Keep whatHappened factual, whyItMatters analytical but grounded, and forEngineers concrete. Do
  not claim Tharun tested, used, built, recommends, prefers, or believes anything.
- Optional learning/model/tool/paper modules may appear only when the findings contain enough
  evidence to fill every included factual field. In modelToKnow, use null for unknown modelSize,
  contextWindow, or license; do not guess them.
- myTake MUST be the empty string. It is a human-only field that Tharun writes and explicitly
  confirms in the admin review flow. Never draft an opinion on his behalf.
- Return ONLY JSON matching this shape, with no markdown fences:
{"schemaVersion":1,"date":string,"title":string,"summary":string,"stories":[{"id":string,"category":"models"|"agents"|"research"|"open_source"|"frameworks"|"infrastructure"|"business"|"developer_tools","sourceLabel":string,"headline":string,"whatHappened":string,"whyItMatters":string,"forEngineers":string,"sourceUrls":string[]}],"oneThingToLearn":{"title":string,"explanation":string,"sourceUrls":string[]}|null,"modelToKnow":{"name":string,"whatItDoes":string,"modelSize":string|null,"contextWindow":string|null,"license":string|null,"whyInteresting":string,"sourceUrls":string[]}|null,"toolOfTheDay":{"name":string,"whatItIs":string,"whenToUse":string,"sourceUrls":string[]}|null,"paperWorthKnowing":{"title":string,"takeaway":string,"sourceUrls":string[]}|null,"myTake":""}`;

/**
 * Produces the private, structured Daily checkpoint. Machine output is never
 * allowed to populate `myTake`; it is overwritten before validation even if the
 * model ignores the instruction. Story IDs are also replaced deterministically so
 * editing/reordering does not depend on model-generated identifiers.
 */
export async function writeDailyBrief(input: {
  findings: Finding[];
  stockQuotes: StockQuote[];
  date: string;
}): Promise<GeneratedDailyBrief> {
  const prompt = `=== TODAY'S RESEARCH FINDINGS (${input.date}) ===
${formatFindings(input.findings)}

Stock quotes are intentionally excluded from the source material: they have no source URL in this
stage and must not become claims in the Daily brief.

Build the structured Daily brief now.`;

  const raw = await complete({
    system: DAILY_BRIEF_SYSTEM,
    prompt,
    maxTokens: 8000,
    model: env.llmModelPremium,
  });
  const jsonText = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      `Daily WRITE stage returned invalid JSON: ${(error as Error).message}\n---\n${raw.slice(0, 500)}`,
    );
  }

  // Normalize IDs before the schema's uniqueness refinement. Two otherwise valid
  // stories may arrive with the same disposable model-supplied ID; identity belongs
  // to deterministic code, not the model. Invalid story fields are left untouched
  // so the real schema still reports them precisely below.
  let forcedHumanBoundary: unknown = parsed;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    const stories = Array.isArray(record.stories)
      ? record.stories.map((candidate) => {
          if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return candidate;
          const story = candidate as Record<string, unknown>;
          const sourceUrls = story.sourceUrls;
          if (
            typeof story.headline !== "string" ||
            !Array.isArray(sourceUrls) ||
            !sourceUrls.every((url): url is string => typeof url === "string")
          ) {
            return candidate;
          }
          return {
            ...story,
            id: createDailyStoryId({
              date: input.date,
              headline: story.headline,
              sourceUrls,
            }),
          };
        })
      : record.stories;
    forcedHumanBoundary = { ...record, schemaVersion: 1, date: input.date, stories, myTake: "" };
  }

  const result = generatedDailyBriefSchema.safeParse(forcedHumanBoundary);
  if (!result.success) {
    throw new Error(
      `Daily WRITE stage output failed schema validation: ${JSON.stringify(result.error.issues)}`,
    );
  }

  const normalized = parseGeneratedDailyBrief(result.data);

  assertUrlsAllowed(
    collectDailySourceUrls(normalized),
    input.findings.flatMap((finding) => finding.sourceUrls),
    "Daily WRITE sources",
  );
  assertNoFabricatedExperience(
    { title: normalized.title, dek: normalized.summary, origin: "ai_generated" },
    JSON.stringify({ ...normalized, myTake: "" }),
    `Daily WRITE output for ${input.date}`,
  );

  return normalized;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Deterministic, table-based email HTML (email clients need this, not flexbox/grid).
 * Includes the required Resend unsubscribe merge tag — see lib/resend.ts.
 */
export function renderDigestEmail(input: {
  date: string;
  title: string;
  dek: string;
  postUrl: string;
  highlights: WriteOutput["emailHighlights"];
  stockQuotes: StockQuote[];
}): string {
  const notableStocks = input.stockQuotes
    .filter((q) => q.percentChange !== null && Math.abs(q.percentChange) >= 2)
    .sort((a, b) => Math.abs(b.percentChange!) - Math.abs(a.percentChange!))
    .slice(0, 8);

  const highlightRows = input.highlights
    .map(
      (h) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e5e5;">
        <a href="${escapeHtml(h.url)}" style="color:#b3261e;text-decoration:none;font-weight:600;">${escapeHtml(h.title)}</a>
        <div style="color:#555;font-size:14px;margin-top:4px;">${escapeHtml(h.oneLiner)}</div>
      </td></tr>`,
    )
    .join("");

  const stockRows = notableStocks
    .map((q) => {
      const up = (q.percentChange ?? 0) >= 0;
      return `<tr>
        <td style="padding:4px 8px;font-family:monospace;">${escapeHtml(q.ticker)}</td>
        <td style="padding:4px 8px;font-family:monospace;color:${up ? "#1a7f37" : "#c92a2a"};">${up ? "+" : ""}${q.percentChange!.toFixed(1)}%</td>
        <td style="padding:4px 8px;color:#555;font-size:13px;">${q.headline ? escapeHtml(q.headline) : ""}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f5f3;font-family:-apple-system,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">
  <tr><td style="padding:28px 28px 8px;">
    <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#b3261e;font-weight:700;">Engineerious Daily — ${escapeHtml(input.date)}</div>
    <h1 style="font-size:22px;line-height:1.3;margin:8px 0 4px;color:#17171a;">${escapeHtml(input.title)}</h1>
    <p style="color:#555;font-size:15px;line-height:1.5;margin:0 0 20px;">${escapeHtml(input.dek)}</p>
  </td></tr>
  <tr><td style="padding:0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${highlightRows}</table>
  </td></tr>
  ${
    notableStocks.length > 0
      ? `<tr><td style="padding:20px 28px 8px;">
    <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#888;font-weight:700;margin-bottom:8px;">Notable moves</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${stockRows}</table>
  </td></tr>`
      : ""
  }
  <tr><td style="padding:24px 28px;">
    <a href="${escapeHtml(input.postUrl)}" style="display:inline-block;background:#17171a;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;font-size:14px;">Read the full post →</a>
  </td></tr>
  <tr><td style="padding:16px 28px 28px;border-top:1px solid #eee;">
    <p style="color:#999;font-size:12px;line-height:1.6;margin:0;">
      Engineerious · ${escapeHtml(env.siteUrl.replace(/^https?:\/\//, ""))}<br/>
      <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#999;">Unsubscribe</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
