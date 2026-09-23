# AI Engineering Handbook authoring

The handbook is a reviewed reference layer, not an automatically generated knowledge base. This directory intentionally contains no publishable `.mdx` entries. The three `.mdx.example` files are inert authoring templates and are never loaded by the site.

## Directory and URL contract

Copy the relevant example to a lowercase kebab-case `.mdx` filename only after replacing every placeholder:

| Entry kind | Source directory | Public URL |
| --- | --- | --- |
| Concept | `concepts/<slug>.mdx` | `/ai/concepts/<slug>` |
| Framework | `frameworks/<slug>.mdx` | `/ai/frameworks/<slug>` |
| Model | `models/<slug>.mdx` | `/ai/models/<slug>` |

The frontmatter `kind` must agree with its directory. A filename is the canonical slug; do not add a separate slug or canonical field.

## Publication boundary

An entry appears publicly only when every condition below is true:

- `draft` is explicitly `false`.
- `authenticityStatus` is `verified`.
- `origin` is `human` or `ai_assisted`. `ai_generated` is always private, regardless of every other flag.
- `reviewedBy` names the human who performed the final review and `reviewedAt` records it. Review time must be at or after `updatedAt`.
- At least one unique HTTP(S) source has a descriptive label, publisher, and access date.
- `myTake` contains the author's own, nonempty analysis.
- Every kind-specific body section exists once, in the prescribed order, with real content.

These are code-enforced conditions in `lib/handbook.ts`, not editorial conventions. Drafts are still validated, so an invalid `.mdx` file fails the build instead of disappearing into a misleading empty state.

## Trust fields

- `origin`: `human`, `ai_assisted`, or `ai_generated`. AI assistance must be disclosed; it does not transfer authorship or review responsibility to a model.
- `sourceStatus`: `primary`, `secondary`, or `mixed`, describing the evidence base.
- `testedStatus`: `not_tested`, `tested_once`, or `replicated`. Do not infer a test from reading documentation or running a vendor demo.
- `authenticityStatus`: `pending` until a human verifies the claims, citations, attribution, My Take, and body.
- `topicSlugs`: explicit membership from the central topic registry (`rag`, `agents`, `mcp`). Leave it empty when the entry does not belong to one of those hubs; topic membership is never inferred from prose.

Machine-written material may report and cite. It may not invent first-person work such as “I benchmarked,” “we deployed,” or “in my experience.” The loader rejects those claims when `origin` is `ai_generated`. A human or AI-assisted origin means a human has actually taken authorship; it is not a flag to use merely to bypass the check.

## Required body structure

My Take lives only in frontmatter and is rendered as a separate signed analysis block. Do not repeat it under a body heading.

Concepts, in order:

1. What is it
2. Why does it exist
3. How it works
4. Architecture
5. Example
6. When to use it
7. When NOT to use it
8. Tools
9. Common mistakes

Frameworks, in order:

1. What is it
2. What problem does it solve
3. When to use it
4. When to avoid it
5. Alternatives
6. Architecture
7. Example
8. Pros
9. Cons

Models, in order:

1. What it is
2. Capabilities
3. Constraints
4. When to use it
5. When not to use it

## Model facts

Model entries also require a `modelFacts` record with the lab, release date, current access status, and openness status. Add optional facts only when the cited sources support them: license, context window, modalities, API availability, local use, tool calling, structured output, reasoning mode, and fine-tuning. The page omits optional facts that are not supplied; never fill an unknown with a guess.

## Review workflow

1. Work in an inert `.mdx.example` copy or a valid `.mdx` entry with `draft: true` and `authenticityStatus: pending`.
2. Replace all placeholders and write every required section. Keep product or model details date-bounded.
3. Open every source and verify the cited claim. Prefer first-party documentation and research; use `sourceStatus` honestly when secondary analysis is necessary.
4. Record testing only when it happened, then write a personal My Take that distinguishes judgment from sourced fact.
5. Set `updatedAt` to the final content edit, perform the human review, and record `reviewedBy` and `reviewedAt`.
6. Run `npm run lint`, `npm run typecheck`, and `npm test` before setting `draft: false`.

Unknown, private, pending, AI-generated, and malformed entries never receive public detail routes, search records, or sitemap URLs.
