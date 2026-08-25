# Creator-first launch runbook

## Public release boundary

The launch boundary has two tiers:

- `/news`, `/models`, and `/resources` are always closed with a 404 and an
  `X-Robots-Tag: noindex, nofollow` header. News and Models are uncurated raw-feed
  surfaces; Resources is placeholder content. An environment flag cannot open them.
- `PUBLIC_RESEARCH_ENABLED` gates `/open-source`, `/submit`, and `/pillars/*`.
  Only the exact value `true` opens them. The default and recommended pre-review
  setting is `false`.

The same policy is applied to public data reads: Archive sees no News or Model rows,
and it sees approved Open Source rows only while the research gate is open. A direct
POST to `/api/submit` also returns 404 while the gate is closed.

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

With `PUBLIC_RESEARCH_ENABLED=false`, run smoke QA with `QA_GATE_CLOSED=true` and
confirm Open Source, Submit, and pillar routes return 404. With the flag set to
`true`, confirm those three route families return 200 and rerun without
`QA_GATE_CLOSED`. In both states, confirm News, Models, and Resources return 404;
Blog and Archive return 200; and the sitemap contains none of the always-closed or
utility routes.
