# Engineerious

A fast, text-first AI content portal in the Hacker News / YC mould, plus a personal-brand blog and a
semi-automated content-repurposing pipeline.

Four content types:

| Section | Route | Sources |
| --- | --- | --- |
| AI News | `/news` | Lab RSS (OpenAI, Google Research, DeepMind, Meta Engineering, Hugging Face), practitioner press, arXiv, Hacker News, optional commercial news API |
| AI Models | `/models` | Hugging Face Hub API — recent, popular, and best-effort trending |
| Open Source | `/open-source` | GitHub Search + Releases, optional Product Hunt |
| Blog | `/blog` | MDX in `content/blog`, organised by three pillars |

Everything is ranked with the Hacker News formula from Paul Graham's `news.arc`:

```
score = (points − 1 + source_weight) / (age_hours + 2)^1.8
```

`source_weight` stands in for votes, so items rank sensibly before any voting exists. Voting can be
added later without changing the formula.

---

## Stack

- **Next.js 15** (App Router, RSC, ISR) + TypeScript + Tailwind v4
- **Neon** serverless Postgres via **Drizzle ORM**
- **Vercel** hosting + Vercel Cron for ingestion
- **MDX on disk** for the blog (typed frontmatter, validated with Zod)
- **beehiiv** for the newsletter, **Buffer** (or Ayrshare) for social scheduling
- **gstack** `/browse` + `/qa` as the pre-deploy verification layer

---

## Quick start

```bash
cp .env.example .env.local     # fill in DATABASE_URL, CRON_SECRET, ADMIN_PASSWORD
npm install
npm run db:generate            # generate SQL from db/schema.ts
npm run db:migrate             # apply to Neon
npm run dev
```

Then populate the feeds:

```bash
npm run cron:all               # hits every /api/cron/* route against localhost:3000
```

Visit <http://localhost:3000>. Three example posts (one per pillar) are already in
`content/blog/` — **replace them before launch**; they are written in the house voice but they are
scaffolding, not your work.

---

## Environment variables

**Required**

| Variable | Why |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `CRON_SECRET` | Authenticates `/api/cron/*`. Routes **fail closed** without it |
| `ADMIN_PASSWORD` | HTTP Basic for `/admin`. `/admin` returns 503 without it — never open |
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
| `BUFFER_TOKEN` (+ `BUFFER_CHANNEL_*`) | Approvals fall back to a no-op dry run |
| `BEEHIIV_API_KEY` / `BEEHIIV_PUBLICATION_ID` | `/api/subscribe` returns a clear 503 |
| `INGEST_REQUIRE_APPROVAL` | Defaults to `false` — ingested items publish immediately |

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

- Vercel Pro (~$20/mo) if you want true hourly news ingestion — see below.
- A social posting API (Buffer from ~$6/mo per channel; Ayrshare higher, more platforms).
- LLM spend for repurposing and "why it matters" notes — small, but non-zero.

---

## Cron schedule

`vercel.json` ships the **Pro** schedule:

| Route | Schedule |
| --- | --- |
| `/api/cron/news` | hourly |
| `/api/cron/models` | daily 06:15 UTC |
| `/api/cron/oss` | daily 06:30 UTC |
| `/api/cron/rank` | every 15 minutes |

**On the Hobby plan this will not run as written.** Hobby allows a small number of cron jobs at
**once per day**, with loose timing. Options:

1. Upgrade to Pro (simplest, ~$20/mo).
2. Trim `vercel.json` to daily schedules and accept daily freshness.
3. Keep the routes and drive them from an external scheduler — a GitHub Actions cron, Inngest, or
   Trigger.dev — hitting `https://<your-domain>/api/cron/<feed>` with
   `Authorization: Bearer $CRON_SECRET`.

Vercel injects that Authorization header automatically for its own cron invocations when
`CRON_SECRET` is set in the project.

---

## The repurposing pipeline

One flagship post → five platform-native drafts → **you approve** → scheduled.

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

Every draft lands as `pending_review`. Review and edit them at `/admin`, then Approve to schedule
via Buffer. Published URLs flow back onto the article's "Distributed to" row.

**There is no auto-publish path anywhere in this codebase, by design.** Approving in `/admin` is the
only action that reaches a social account. Keep it that way.

Platform reality check: Meta (Instagram/Facebook), LinkedIn and YouTube require app review and
Business/Creator accounts; X moved to pay-per-request billing in February 2026. Using a unified
posting API is what makes this tractable for one person.

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
  page.tsx                    unified ranked front page
  news|models|open-source/    section feeds + item detail routes
  blog/[slug]/                MDX article
  pillars/[pillar]/           pillar hubs
  admin/                      approval console (HTTP Basic via middleware.ts)
  api/cron/{news,models,oss,rank}/
  api/{repurpose,subscribe,submit}/
  api/admin/{items,repurpose,submissions}/
components/                   Row, FeedList, SectionTabs, Nav, NewsletterCTA, PillarBadge, AdminQueue
lib/
  ranking.ts dedupe.ts ingest.ts queries.ts auth.ts llm.ts env.ts
  adapters/                   one file per source, all behind IngestAdapter
  content/                    MDX loader (Zod-validated frontmatter) + DB mirror
  repurpose/                  draft generation + Publisher interface (Buffer, Ayrshare, dry-run)
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
