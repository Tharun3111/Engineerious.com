# Creator-first launch runbook

## Public release boundary

`PUBLIC_RESEARCH_ENABLED` gates `/open-source`, `/resources`, `/submit`, and
`/pillars/*` (404 + noindex when off — see `middleware.ts`, `lib/public-launch.ts`,
`app/robots.ts`). As of the daily-digest system build (2026-08), this flag is set
`true` in production: the whole site is live while the automated research→write→
review pipeline is built behind it, rather than waiting for the full pipeline before
opening the site back up. Re-close the gate (`PUBLIC_RESEARCH_ENABLED=false`) if a
problem surfaces on those routes specifically — it's a one-env-var rollback, no
deploy needed.

## Publishing a post

1. Verify every first-person claim and source.
2. Set `authenticityStatus: verified` and include `reviewedBy` and `reviewedAt` in the post frontmatter.
3. Keep AI provenance accurate in `origin`; do not describe AI-generated work as firsthand experience.
4. Run `npm run typecheck`, `npm run lint`, `npm run test:coverage`, and `npm run build` before deployment.

## Newsletter

Subscriber capture and sending run on Resend (`lib/resend.ts`), not beehiiv — beehiiv's
programmatic send capability is gated behind a paid plan regardless of subscriber
count, so it's kept only as an optional passive signup embed
(`NEXT_PUBLIC_BEEHIIV_EMBED_URL`). `/api/subscribe` requires `RESEND_API_KEY`,
`RESEND_SEGMENT_ID`, and `RESEND_FROM_ADDRESS` — without them it returns a clear 503
rather than silently failing. Sending is triggered by approving the day's digest in
`/admin`, not by a separate manual "send" step (see the daily-digest pipeline once
it's built — this doc will be updated when that lands).

## Distribution (LinkedIn + Instagram)

Generate LinkedIn or Instagram copy from a verified post, approve it in the admin queue, then publish it manually. Approval marks content copy-ready; it does not schedule or publish anything.

## Deployment verification

Run the following against the Vercel preview and production URLs:

```bash
BASE_URL=https://example.vercel.app npm run qa:smoke
BASE_URL=https://example.vercel.app npm run test:e2e
```

With `PUBLIC_RESEARCH_ENABLED=true` (current default, see above): confirm
`/open-source`, `/resources`, `/submit`, and pillar routes return 200 with no
`X-Robots-Tag` header. Confirm `/news`, `/models`, and `/blog` return 200 without a
feed error state.
