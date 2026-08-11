# Creator-first launch runbook

## Public release boundary

The launch release exposes the home page, News, Models, Blog, About, Subscribe, and
verified original posts. Open-source, resource, submission, and pillar routes remain
unavailable unless `PUBLIC_RESEARCH_ENABLED=true` is explicitly configured.

Do not enable that flag until the research pipeline has passed editorial, attribution, retention, and operational review.

## Publishing a post

1. Verify every first-person claim and source.
2. Set `authenticityStatus: verified` and include `reviewedBy` and `reviewedAt` in the post frontmatter.
3. Keep AI provenance accurate in `origin`; do not describe AI-generated work as firsthand experience.
4. Run `npm run typecheck`, `npm run lint`, `npm run test:coverage`, and `npm run build` before deployment.

## Newsletter

The site collects subscriptions only when a Beehiiv embed URL or API credentials are configured. Send issues manually after a final human review. The launch makes no fixed-cadence promise.

## LinkedIn distribution

Generate LinkedIn copy from a verified post, approve it in the admin queue, then publish it manually. Approval marks content copy-ready; it does not schedule or publish anything.

## Deployment verification

Run the following against the Vercel preview and production URLs:

```bash
BASE_URL=https://example.vercel.app npm run qa:smoke
BASE_URL=https://example.vercel.app npm run test:e2e
```

Confirm `/open-source`, `/resources`, `/submit`, and pillar routes return 404 and carry
`X-Robots-Tag: noindex, nofollow` before promoting the release. Confirm `/news`,
`/models`, and `/blog` return 200 without a feed error state.
