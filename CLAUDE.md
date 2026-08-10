# Engineerious — agent notes

AI content portal + personal-brand blog. Next.js 15 App Router, TypeScript, Tailwind v4, Drizzle +
Neon Postgres, deployed on Vercel.

## Browser work

**Use gstack `/browse` for all browser automation.** Do not use other browser tooling in this repo.
QA workflow and assertions: [gstack/README.md](gstack/README.md).

## Shape of the thing

- Three ingested feeds (`news`, `model`, `oss`) live in one `items` table so the front page can rank
  them together. Blog posts are MDX on disk; `posts` in Postgres is only a mirror for repurposing.
- Ranking is the Hacker News formula from `news.arc`:
  `score = (points − 1 + source_weight) / (age_hours + 2)^1.8`. It exists twice — `lib/ranking.ts`
  for insert-time scoring and the SQL in `app/api/cron/rank/route.ts` for the rescore sweep.
  **Change both together.**
- Dedupe is `sha256(canonical_url)` in `lib/dedupe.ts`. `first_seen` is never overwritten on
  conflict; that is what stops re-ingested items resurfacing as new.

## Rules that are not obvious from the code

- **Never add an auto-publish path.** Approval in `/admin` → `POST /api/admin/repurpose` is the only
  route to a social network. Adding a cron that publishes would break the product's core promise.
- **Every LLM-generated string shown to a reader must be labelled** as AI-generated in the UI. See
  the `aiNote` treatment in `components/Row.tsx`.
- **Adapters fail soft, individually.** One dead RSS feed returns a failed `AdapterResult`; it must
  never abort a whole cron run.
- **Feed pages distinguish empty from broken.** `data-feed-state="ok|empty|error"` is load-bearing —
  the QA gate asserts on it.
- **Licensing constraints are real and are commented at the call site.** Product Hunt's API is
  non-commercial; NewsAPI.org and GNews free tiers cannot be used in production. Do not wire in a
  provider without checking its current terms.

## Voice

Blog and generated social copy use the "Pragmatic Practitioner" system prompt in `lib/llm.ts`:
objective, technical, evidence-led, low-hype. No hype vocabulary, no invented benchmarks, name the
tradeoffs. Match it in any copy you write.

## Commands

```bash
npm run dev            # local dev
npm run typecheck      # tsc --noEmit
npm run lint
npm run build
npm run db:generate    # drizzle-kit generate — after editing db/schema.ts
npm run db:migrate
npm run cron:all       # trigger every ingestion route against BASE_URL
npm run qa:smoke       # cheap deploy gate; run before gstack /qa
```
