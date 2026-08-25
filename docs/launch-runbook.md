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

## Publishing a Daily Brief

1. Run the daily gather/research job, then the structured writer. The writer checkpoints a
   private `daily_draft`; it does not create public content, a blog post, or an email.
2. Open the digest in `/admin`, inspect the lazily loaded findings and raw evidence, and edit any
   factual field that needs correction. Source URLs must exactly match gathered HTTP(S) evidence.
3. Save the revision and run factual review again after any factual edit. A review with grounding,
   voice, or generic-content flags is not publishable.
4. Write Tharun's Take yourself, save it, then explicitly confirm that exact saved text. Editing
   it later invalidates the confirmation.
5. Select `Publish Daily`. Publication locks the digest and atomically copies the reviewed draft
   into the immutable `daily_published` snapshot. A stale editor, rejected digest, changed review
   hash, or changed Take hash fails closed.

Public `/daily` routes and the sitemap read only valid published snapshots. Before the first valid
snapshot exists, `/daily` remains useful but `noindex`; dated drafts return 404. Publishing does not
send a newsletter.

## Newsletter

Postgres is the subscriber source of truth. Resend (`lib/resend.ts`) is optional for
contact sync and delivery; a valid signup is still captured when Resend is absent or
temporarily unavailable. Beehiiv remains only an optional passive embed
(`NEXT_PUBLIC_BEEHIIV_EMBED_URL`). Approving a digest publishes the web artifact only.
Newsletter delivery requires its own reviewed, idempotent action; it is never coupled
to web approval.

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
Blog, Daily, and Archive return 200; and the sitemap contains none of the always-closed
or utility routes. `/daily` appears in the sitemap only after a valid published snapshot exists.
