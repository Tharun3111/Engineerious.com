# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Engineerious: a Next.js 16 (App Router) site that ranks AI news/model/open-source items with the
Hacker News formula and publishes Tharun Chowdary's engineering writing, backed by Postgres
(Neon in prod, node-postgres locally) via Drizzle, deployed on Vercel. The UI uses
Instrument Sans with restrained Martian Mono display/utility text and a blue/navy palette.

## Commands

```bash
npm run dev                    # local dev (Turbopack)
npm run typecheck              # tsc --noEmit
npm run lint
npm run build

npm test                       # vitest run (tests/*.test.ts)
npx vitest run tests/frontmatter.test.ts   # single unit test file
npm run test:coverage          # vitest with coverage — see gate below
npm run test:e2e               # playwright (e2e/*.spec.ts), starts its own dev server
npx playwright test e2e/brand-flow.spec.ts # single e2e file
BASE_URL=https://preview.vercel.app npm run test:e2e  # against a deployed URL, no local server

npm run db:generate            # drizzle-kit generate — after editing db/schema.ts
npm run db:migrate
npm run cron:all               # trigger every ingestion route against BASE_URL (default localhost:3000)
npm run qa:smoke               # dependency-free deploy gate; run before gstack /qa or e2e
```

**Coverage gate**: `vitest.config.mts` enforces **100% statements/branches/functions/lines**, but
only on three files: `lib/content/frontmatter.ts`, `lib/public-launch.ts`,
`lib/repurpose/launch-policy.ts`. Any change to those three needs a matching test change or
`test:coverage` fails. Other files are untracked by the coverage gate.

**Browser automation**: use gstack `/browse` for all of it — do not add Puppeteer/other drivers.
QA workflow and DOM assertions the gate relies on: `gstack/README.md`.

## Architecture

### Launch gate — the site is deliberately smaller than the codebase

`proxy.ts` always closes `/news`, `/models`, and placeholder `/resources`; it also
closes `/open-source`, `/submit`, and `/pillars/*` unless
`PUBLIC_RESEARCH_ENABLED=true`. Every closed response is a 404 with
`X-Robots-Tag: noindex, nofollow`. Query and sitemap boundaries mirror the route gate.
`docs/launch-runbook.md` is the source of truth for what's live vs. deferred and the pre-promote
checklist (`qa:smoke` + `test:e2e` + a 404/noindex check on the deferred paths).

### Editorial integrity is enforced in the frontmatter schema, not by convention

`lib/content/frontmatter.ts` requires every MDX post to declare `format`, `origin` (`human` |
`ai_assisted` | `ai_generated`), `sourceStatus`, `testedStatus`, and `authenticityStatus`. A
`superRefine` makes `authenticityStatus: verified` invalid without both `reviewedBy` and
`reviewedAt` — a post cannot be marked verified without a named human reviewer and a timestamp.
`docs/daily-codex-editorial-task.md` describes the scheduled agent pipeline that drafts posts
(`editorial_aggregator` finds candidates → drafts land under `content/blog` with
`draft: true, origin: ai_generated, authenticityStatus: pending` → `editorial_reviewer` checks
claims) and sourced research briefs land in `content/research/YYYY-MM-DD-topic.md` even when no
draft is written. That pipeline never sets `draft: false` or `authenticityStatus: verified` and
never commits/pushes/deploys/publishes — only Tharun does, by hand. Preserve that boundary in any
change to the pipeline or the schema.

### Ranking and dedupe — the two places that must move together

Three ingested types (`news`, `model`, `oss`) live in one `items` table so the home page can rank
them together. Ranking is the Hacker News `news.arc` formula,
`score = (points − 1 + source_weight) / (age_hours + 2)^1.8`. Shared constants live
in `lib/ranking.ts` and are consumed by insert-time scoring and the raw SQL sweep.
Dedupe is `sha256(canonical_url)`
(`lib/dedupe.ts`); `first_seen` is never overwritten on conflict, which is what stops a re-ingested
item resurfacing as new.

### Ingestion adapters

One file per source in `lib/adapters/`, all implementing `IngestAdapter` from
`lib/adapters/types.ts` (`slug`, `name`, `type`, `enabled()`, `fetch(): RawItem[]`), registered in
`lib/adapters/index.ts`. `lib/ingest.ts` handles upsert/dedupe/error-isolation for all of them — a
dead adapter returns a failed `AdapterResult` and never aborts the run. Source authority is set
per-source in `lib/sources.ts` (`SOURCE_WEIGHTS`, `RSS_SOURCES`) — this is what lets a primary-lab
post outrank a rewrite of it before any votes exist. Two licensing constraints are load-bearing,
not stylistic: Product Hunt's API is non-commercial (adapter ships disabled), and NewsAPI.org/GNews
free tiers cannot be used in production (`lib/adapters/news-api.ts` only wires up
Newsdata/Currents/APITube).

### DB driver switches on the connection string, not on environment

`lib/db.ts` picks `drizzle-orm/neon-http` when `DATABASE_URL` host matches `*.neon.(tech|build)`,
else `drizzle-orm/node-postgres`. Neon's serverless client only speaks Neon's HTTP proxy protocol —
it cannot reach a local/Docker/any other plain Postgres, which silently fails queries rather than
erroring at connect time if you bypass this. Local dev against Docker Postgres needs a plain
`postgresql://` URL (not a neon.tech host) to hit the node-postgres path.

### Blog content

MDX on disk in `content/blog/*.mdx` is the source of truth; `posts` in Postgres is only a mirror
(`lib/content/sync.ts`) written on-demand when a post is repurposed, so distribution links have a
stable row to attach to. `content/research/*.md` holds sourced research briefs that did not clear
the bar to become a post — check both directories for topic duplication before starting new work
on a topic.

### Repurposing — human approval is the only path to a network

`lib/repurpose/launch-policy.ts` currently restricts repurposing to LinkedIn and Instagram
(`LAUNCH_PLATFORMS`); `resolveLaunchPlatforms` throws on any other platform. One flagship post fans
out to a draft via `lib/repurpose/`, using per-platform prompt templates in `content/prompts/*.md`
in the "Pragmatic Practitioner" voice defined in `lib/llm.ts`. Every draft lands `pending_review`.
**Approving a draft in `/admin` marks it copy-ready — it does not publish or schedule anything**;
`lib/repurpose/publisher.ts` (Buffer/Ayrshare/dry-run) exists but per the current launch policy
publishing is manual. Do not add an automated publish path.

### Feed state is part of the contract, not just UI polish

`FeedList`/section pages render `data-feed-state="ok" | "empty" | "error"` explicitly — "cron
hasn't run yet" and "database unreachable" are different failure modes and both `qa:smoke` and the
Playwright suite assert on which one fired. Keep new feed-rendering code emitting this attribute.

## Commands cheat sheet for this repo specifically

- `npm run cron:all` hits ingestion, rank, daily research, and daily write routes against `BASE_URL` (default
  `localhost:3000`) — the only way to populate feeds in dev, since there's no seed data.
- `/api/cron/*` and `/api/admin/*` fail closed without `CRON_SECRET` / `ADMIN_PASSWORD` set — see
  `lib/auth.ts` and `proxy.ts`.
- `.env.example` is the definitive list of env vars and which ones degrade gracefully vs. are
  required; most external integrations (news API, Buffer, beehiiv, Product Hunt, LLM) are optional
  and the corresponding feature returns a clear error/disabled state rather than crashing when
  unset.

## Codex integration detected

This repo has an OpenAI Codex config (`.codex/`) driving the daily editorial pipeline described in
`docs/daily-codex-editorial-task.md`. Reply `/import` to scan and list what's importable (agents,
instructions), then `/import --yes=<digest>` to apply it — I have not read `.codex/` contents
directly.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
