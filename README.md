# Engineerious

A text-first AI engineering desk: reviewed intelligence, technical writing, and a
semi-automated research pipeline under Tharun Chowdary Malepati's byline.

Public content surfaces:

| Section | Route | Sources |
| --- | --- | --- |
| AI desk | `/ai` | Immutable, human-curated snapshots from approved News, Model, and gated OSS candidates |
| Topic maps | `/topics/rag`, `/topics/agents`, `/topics/mcp` | Active only with verified Writing or enough explicitly tagged reviewed signal |
| Open Source | `/open-source` | Approved GitHub releases; gated by `PUBLIC_RESEARCH_ENABLED` |
| Daily | `/daily` | Human-reviewed, source-linked structured Daily Brief snapshots |
| Writing | `/blog` | Verified MDX writing; automated Daily content is excluded |
| Projects | `/projects` | Repository-backed case studies |

Raw `/news` and `/models` stay closed even though ingestion continues. `/resources`
is always closed while it contains placeholders. `/submit` and pillar
routes use the same research launch gate as Open Source. Closed content is filtered
from Archive data and omitted from the sitemap; route middleware is not the only
visibility boundary.

Everything is ranked with the Hacker News formula from Paul Graham's `news.arc`:

```
score = (points − 1 + source_weight) / (age_hours + 2)^1.8
```

`source_weight` stands in for votes, so items rank sensibly before any voting exists. Voting can be
added later without changing the formula.

---

## Stack

- **Next.js 16** (App Router, RSC, ISR) + React 19.2, TypeScript, and Tailwind v4
- **Neon** serverless Postgres via **Drizzle ORM**
- **Vercel** hosting + Vercel Cron for ingestion
- **MDX on disk** for the blog (typed frontmatter, validated with Zod)
- Postgres-backed subscriptions with optional **Resend** delivery; social drafts stay manual
- **gstack** `/browse` + `/qa` as the pre-deploy verification layer

---

## Quick start

```bash
cp .env.example .env.local     # fill required database, auth, and rate-limit secrets
npm install
npm run db:generate            # generate SQL from db/schema.ts
npm run db:migrate             # apply to Neon
npm run dev
```

Then populate the feeds:

```bash
npm run cron:all               # hits every /api/cron/* route against localhost:3000
```

Visit <http://localhost:3000>. `content/blog/` is intentionally not populated with
fabricated example experience; add only writing whose claims and provenance can be
verified.

---

## Environment variables

**Required**

| Variable | Why |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `CRON_SECRET` | Authenticates `/api/cron/*`. Routes **fail closed** without it |
| `ADMIN_PASSWORD` | HTTP Basic for `/admin`. `/admin` returns 503 without it — never open |
| `MUTATION_RATE_LIMIT_SECRET` | Server-only, stable 32-128-byte hex HMAC key for public POST limits. Generate with `openssl rand -hex 32`; production mutations fail closed without it |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for metadata, sitemap, RSS |

**Optional** — every one of these degrades gracefully; the adapter or feature reports itself
unconfigured and is skipped.

| Variable | Effect if unset |
| --- | --- |
| `GITHUB_TOKEN` | Search drops to 10 req/min (from 30). You will hit the limit |
| `HF_TOKEN` | None — the Hub endpoints used are public |
| `PRODUCTHUNT_TOKEN` | Product Hunt adapter skipped |
| `NEWS_API_PROVIDER` / `NEWS_API_KEY` | Commercial news fill-in skipped |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | `/api/repurpose` returns 503 |
| `RESEND_API_KEY` / `RESEND_SEGMENT_ID` | Signups still persist in Postgres; delivery is unavailable |
| `INGEST_REQUIRE_APPROVAL` | Defaults to review-first; set `false` only for private fixtures |

---

## Free vs paid data sources

**Free, no card, commercial use fine**

- All RSS/Atom feeds (labs, press, arXiv)
- Hacker News Algolia API — no key at all
- Hugging Face Hub API — token optional
- GitHub REST — a free PAT raises search from 10 to 30 req/min

**Free tier, but read the terms**

- Newsdata.io / Currents / APITube — ~1,000 req/day, commercial use permitted. These are the three
  wired up in `lib/adapters/news-api.ts`.
- Product Hunt — free non-expiring developer token, **but the API terms are non-commercial**.
  Ships disabled. Confirm your use is acceptable or drop it.

**Do not use**

- **NewsAPI.org** — free "Developer" tier is development-only, not for production.
- **GNews** — free tier prohibits commercial use.

**Likely paid line items**

- LLM spend for repurposing and "why it matters" notes — small, but non-zero.

---

## Cron schedule

`vercel.json` intentionally ships a once-daily schedule:

| Route | Schedule |
| --- | --- |
| `/api/cron/news` | 08:00 UTC daily |
| `/api/cron/models` | 08:15 UTC daily |
| `/api/cron/oss` | 08:30 UTC daily |
| `/api/cron/rank` | 08:45 UTC daily |
| `/api/cron/daily-digest` | 09:00 UTC daily |
| `/api/cron/daily-write` | 09:20 UTC daily |

Confirm the number of configured jobs against the limits of the Vercel plan used for
the project. The same routes can also be driven by an external scheduler with
`Authorization: Bearer $CRON_SECRET`.

Vercel injects that Authorization header automatically for its own cron invocations when
`CRON_SECRET` is set in the project.

---

## The repurposing pipeline

One flagship post → platform-native drafts → **you approve** → manual copy-ready output.

```bash
curl -X POST https://engineerious.com/api/repurpose \
  -H "Authorization: Bearer $ADMIN_PASSWORD" \
  -H "content-type: application/json" \
  -d '{"slug":"45-eval-metrics-six-that-mattered"}'
```

That generates LinkedIn (post + carousel outline), an X thread, an Instagram caption + carousel +
alt text, a ~45s YouTube Shorts script, and a Facebook post — each from a per-platform template in
`content/prompts/`, each written in the Pragmatic Practitioner voice, none of them a copy-paste of
another.

Every draft lands as `pending_review`. Review and edit it at `/admin`; approval marks it
copy-ready but does not contact a social network.

**There is no auto-publish path anywhere in this codebase, by design.** Keep it that way.

Platform reality check: Meta (Instagram/Facebook), LinkedIn and YouTube require app review and
Business/Creator accounts; X moved to pay-per-request billing in February 2026. Using a unified
posting API is what makes this tractable for one person.

---

## The Daily Brief pipeline

Daily is a separate, structured publication type; it is not an automatically generated blog post.

1. `/api/cron/daily-digest` gathers and stores source evidence.
2. `/api/cron/daily-write` writes a private `daily_draft`, validates every citation against the
   gathered URLs, and runs an adversarial factual/voice review.
3. `/admin` lets the human editor revise facts, inspect the stored evidence, write Tharun's Take,
   rerun review, and explicitly confirm the exact saved Take.
4. `Publish Daily` atomically freezes that reviewed revision into `daily_published`.
5. Public routes read `daily_published` only. Drafts never become a fallback when data is missing
   or invalid.

Web publication does not send email or create a blog post. Newsletter delivery remains a separate
outbox in `/admin`:

1. Prepare deterministic email HTML from the immutable published Daily snapshot.
2. Save the subject and inspect the exact email in the sandboxed preview.
3. Approve that subject and HTML as one revision.
4. Send with a separate, confirmed action. Any active captured subscriber without a Resend contact
   ID blocks the send claim.
5. Reconcile `sending` or `queued` records against their stored provider broadcast ID. Never retry
   an uncertain send or create a replacement broadcast.

The public signup path normalizes addresses and writes the Postgres capture ledger before trying
Resend. Every accepted request returns the same generic receipt, whether the address is new,
already synced, pending repair, or opted out at the provider; public responses never reveal that
state. Before capture, one Postgres function locks and checks both a per-client and
per-normalized-address fixed-window dimension, then increments both or neither. Only keyed HMAC
digests reach that counter table; raw client addresses and signup addresses do not. Known provider
contacts are not mutated by duplicate public submissions. `/admin` exposes a
bounded, one-contact retry queue only for rows that never received a provider contact ID. The site
does not reactivate an opted-out address without a future email-ownership confirmation flow.

## Curating the AI desk

Approval is only moderation; it never makes a raw News or Model row public. In `/admin`, the
editor rewrites an approved candidate's title and summary, selects an explicit category/topic,
and writes the engineering consequence. Publishing freezes the exact source facts and reviewed
copy into an immutable snapshot. If ingestion changes any reviewed input while the form is open,
publication returns a conflict and requires a fresh review.

`/ai`, active topic hubs, the homepage preview, sitemap, and `/api/search` read those snapshots
only. Live score remains ranking metadata; ingestion can never rewrite public prose or source
attribution after curation. A topic becomes public with one verified Writing entry or three
explicitly tagged curated signals, so placeholder hubs remain 404/noindex.

---

## QA and deploys

```bash
BASE_URL=https://<preview>.vercel.app npm run qa:smoke
```

Dependency-free gate: status codes, feed population (`data-feed-state`), newsletter CTA presence,
and confirmation that `/admin` and the cron routes still reject unauthenticated requests.

Then the real pass with gstack — `/qa-only <preview-url>`, `/browse responsive`,
`/browse diff <prod> <preview>`, `/browse console`, `/browse network`. Full checklist and
assertions: **[gstack/README.md](gstack/README.md)**.

---

## Layout

```
app/
  page.tsx                    personal desk + latest reviewed Daily/writing/AI/project
  daily/[date]/               structured, human-reviewed Daily Brief snapshots
  ai/                         immutable reviewed AI signal desk
  topics/[slug]/              evidence-threshold topic maps
  news|models|open-source/    section feeds + item detail routes
  blog/[slug]/                MDX article
  pillars/[pillar]/           pillar hubs
  admin/                      approval console (HTTP Basic via proxy.ts)
  api/cron/{news,models,oss,rank,daily-digest,daily-write}/
  api/{search,repurpose,subscribe,submit}/
  api/admin/{curated-ai,digests,items,newsletters,repurpose,subscribers,submissions}/
components/                   public desk, Daily Brief, feed, navigation, forms, and admin editors
lib/
  daily-{brief,publish,queries}.ts curated-ai*.ts newsletter*.ts subscriber*.ts public-rate-limit.ts topics.ts search-index.ts ranking.ts dedupe.ts ingest.ts queries.ts auth.ts llm.ts env.ts
  adapters/                   one file per source, all behind IngestAdapter
  content/                    MDX loader (Zod-validated frontmatter) + DB mirror
  repurpose/                  reviewed, copy-ready draft generation
db/schema.ts                  Drizzle schema
content/blog/*.mdx            posts
content/prompts/*.md          per-platform repurposing templates
gstack/README.md              QA workflow
scripts/                      run-cron.mjs, qa-smoke.mjs
```

## Known source gaps

Verified by probing every adapter on 2026-08-09:

- **Anthropic has no public RSS feed.** `/rss.xml`, `/news/rss.xml`, `/feed.xml` and `/index.xml`
  all 404. Their announcements reach the feed via Hacker News and MarkTechPost instead. Re-check
  occasionally and add the source the day it exists.
- **ai.meta.com/blog has no feed either** — Meta comes in through the `engineering.fb.com`
  ML-applications category feed.
- **No lab publishes a model-release-only feed.** OpenAI's per-category feeds return 403, so
  `MODEL_RSS_SOURCES` is intentionally empty and `/models` is Hugging Face driven.
- **arXiv returns a valid but empty feed at weekends.** Zero items from `arxiv-cs-*` on a Saturday
  or Sunday is normal, not an outage.
- **GitHub repository search has no boolean OR.** `(topic:a OR topic:b)` returns `total_count: 0`
  with a 200. The adapter issues one query per topic for that reason — do not "optimise" it back
  into a single query.

## Adding a source

1. Write an adapter in `lib/adapters/` implementing `IngestAdapter` (`slug`, `name`, `type`,
   `enabled()`, `fetch()`), returning `RawItem[]`.
2. Give it a weight in `lib/sources.ts` — 5 for a primary lab, 1 for a firehose.
3. Register it in the right list in `lib/adapters/index.ts`.

Dedupe, scoring, upsert, error isolation, and source bookkeeping are handled by `lib/ingest.ts`. An
RSS source needs no new adapter at all — just an entry in `RSS_SOURCES`.
