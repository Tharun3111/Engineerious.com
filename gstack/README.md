# gstack QA layer

gstack is Garry Tan's open-source Claude Code skill pack (<https://github.com/garrytan/gstack>).
Two of its skills are the pre-deploy verification layer for Engineerious. They are **dev/CI tooling
only** — nothing in `/gstack` runs at request time or ships in the Next.js bundle.

## Install

Requires Claude Code, Git, and Bun v1.0+ (plus Node.js on Windows). macOS and Linux are the
no-caveat platforms.

```bash
npx skills add https://github.com/garrytan/gstack --skill browse
npx skills add https://github.com/garrytan/gstack --skill qa
```

- **`/browse`** — persistent Playwright-managed Chromium daemon. First call ~3s, then ~100ms per
  command; state persists between commands. `goto`, `snapshot` (`-D` unified diff, `-a` annotated
  screenshot), `screenshot`, `click/fill/hover/press/type/select/scroll`, `upload`, `responsive`,
  `console`, `network`, `perf`, `diff <url1> <url2>`, dialog handling, and
  `is visible|enabled|checked` assertions.
- **`/qa`** — browser-based testing that finds bugs *and fixes them in source*, with a structured
  health-score report and before/after screenshots. Three tiers: Quick / Standard / Exhaustive.
  Use **`/qa-only`** when you want the report without code changes — that is the right choice for a
  deploy gate.

## Deploy gate

Run against the **Vercel preview URL**, never production. Promote only if the smoke script passes,
`/qa-only` reports no blocking issues, and the diff against production shows no unintended change.

### 0. Cheap checks first

```bash
BASE_URL=https://<preview>.vercel.app npm run qa:smoke
```

Status codes, feed population, newsletter CTA presence, and that `/admin` plus the cron routes are
still refusing unauthenticated requests. Fails fast and costs nothing. Everything below only runs
if this passes.

### 1. Full click-through

```
/qa-only https://<preview>.vercel.app
```

Cover, in order: home feed → `/news` → `/models` → `/open-source` → a `/blog/[slug]` →
`/subscribe`. What must hold:

- Every feed page renders **populated rows**. The pages emit `data-feed-state="ok|empty|error"` and
  `data-feed-count` on the list element specifically so this is assertable:
  ```
  /browse goto https://<preview>.vercel.app/news
  /browse is visible '[data-feed-state="ok"]'
  ```
  `empty` means the ingestion cron has not run. `error` means the database is unreachable. They are
  different bugs and the gate must not conflate them.
- **No console errors and no failed network requests** on any of the four feeds:
  ```
  /browse console
  /browse network
  ```
  A feed that renders while a fetch 500s in the background is a feed that will be empty tomorrow.
- Outbound row links carry `rel="noopener noreferrer nofollow"` and open in a new tab.

### 2. Responsive

```
/browse responsive
```

Mobile 375×812, tablet 768×1024, desktop 1280×720. The rows are text-dense by design, so the
failure to watch for is horizontal overflow from long titles and long model ids
(`org/some-extremely-long-model-name`), and the nav wrapping into the subscribe button.

### 3. Regression diff against production

```
/browse diff https://engineerious.com https://<preview>.vercel.app
/browse snapshot -D
```

Feed *content* legitimately differs between environments — different ingest timing, different
ranking snapshot. Read the diff for **structural** change: a missing section, a broken row layout, a
disappeared newsletter form. Content churn is noise here; structure is the signal.

### 4. Forms and authenticated screens

Newsletter:

```
/browse goto https://<preview>.vercel.app/subscribe
/browse fill '#newsletter-email' 'qa+preview@engineerious.com'
/browse click 'button[type="submit"]'
/browse is visible '[data-subscribe-status]'
```

A `data-subscribe-status="error"` on a preview with no `BEEHIIV_API_KEY` is **correct behaviour**,
not a bug — the route is meant to return a clear 503. What would be a bug is a silent failure with
no status element at all.

Submission form: same pattern against `/submit`, asserting `[data-submit-status]`.

`/admin` is HTTP Basic (`middleware.ts`). Import real browser cookies/credentials with gstack's
`/setup-browser-cookies`, or drive it with the header directly, then verify the repurpose queue
renders and the Approve button is present. **Do not click Approve on a preview that has a real
`BUFFER_TOKEN` in its environment** — approval is the one action in this codebase that reaches a
live social account.

### 5. Performance

```
/browse perf
```

The target is sub-second loads on the feed pages. They are server-rendered text with no images and
no client JS beyond the newsletter form, so anything slow is a data-layer problem — usually a cold
Neon branch, not the frontend.

## Verifying ingestion actually worked

QA of a content site is meaningless if the content pipeline is broken. Against a preview:

```bash
BASE_URL=https://<preview>.vercel.app npm run cron:all
```

Exits non-zero if any adapter failed and prints the per-adapter breakdown. Adapters reporting
`not configured` are skipped by design (no token set), which is not a failure.

## CLAUDE.md note

The repo's `CLAUDE.md` instructs the agent to use gstack `/browse` for all browser work rather than
any other browser tooling. Keep that in place — mixing browser drivers in one session is how you get
two Chromium instances fighting over a profile.
