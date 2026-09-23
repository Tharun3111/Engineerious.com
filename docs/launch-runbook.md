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

## Publishing a curated AI signal

1. Approve the ingestion candidate. This is moderation only and does not expose it publicly.
2. In the Curated AI desk queue, verify the outbound source and every displayed source fact.
3. Rewrite the title and summary, choose a category, tag only exact RAG/Agents/MCP membership,
   and write the engineering consequence in “Why it matters.” Never copy the ingestion AI note.
4. Publish the curated snapshot. If any reviewed source input changed while the form was open,
   reload and review the new version; the API deliberately returns a conflict.
5. To revise public copy, unpublish first and create a new reviewed snapshot. Public copy is never
   edited in place.

The AI desk, homepage, search, topic maps, and sitemap read immutable curated snapshots only.
Live score may reorder them, but cannot change their prose or attribution. A topic route is linked
or indexed only after one verified Writing entry or three explicitly tagged curated signals.

## Public mutation abuse boundary

`/api/subscribe` and `/api/submit` use durable Postgres fixed-window counters before any
subscriber, provider, or submission mutation. Subscribe consumes a per-client counter (10 per 15
minutes) and a per-normalized-email counter (3 per hour) together. Submit consumes a per-client
counter (5 per hour). The database function acquires transaction-level advisory locks for every
requested dimension in deterministic hash order, rechecks them after locking, then increments all
dimensions or none. Concurrent requests cannot race an allowance, partially burn an unrelated
quota, or deadlock by acquiring overlapping dimensions in a different order. The function validates
PostgreSQL's default `READ COMMITTED` isolation so the post-lock check always sees the preceding
caller's commit; a non-default isolation setting fails closed.

The database receives only domain-separated HMAC-SHA256 identity digests. It never receives raw
client addresses or signup addresses for rate limiting. Generate a stable key with
`openssl rand -hex 32` and set it as `PUBLIC_MUTATION_RATE_LIMIT_SECRET` in every Vercel Preview and
Production environment. Apply `db/migrations/0010_bent_susan_delgado.sql` before deploying the
routes (`npm run db:migrate`). If the key, trusted forwarding address, database, or migration is
unavailable in production, the mutation fails closed. Subscribe still returns its ordinary generic
success receipt so limiter health and subscriber/opt-out state cannot be enumerated; Submit returns
429 when limited and 503 when enforcement is unavailable. Keep Vercel's overwritten forwarding
headers intact, or configure any replacement trusted proxy to overwrite `x-forwarded-for`.

## Newsletter

Postgres is the durable subscriber capture and sync ledger. Resend (`lib/resend.ts`) remains
authoritative for provider-side unsubscribe state. A valid signup is stored before provider work,
even when Resend is absent or temporarily unavailable. Every accepted public request returns the
same generic receipt; new, existing, pending, and provider-opted-out states are never exposed.
Duplicate public submissions do not mutate known provider contacts or reactivate an opt-out.
Resubscription needs a future email-ownership confirmation flow. Provider sync details remain in
the authenticated admin queue.
Beehiiv remains only an optional passive embed (`NEXT_PUBLIC_BEEHIIV_EMBED_URL`).

Approving or publishing a Daily Brief never sends email. Operate the separate outbox in `/admin`:

1. Prepare a newsletter from a valid published structured Daily snapshot.
2. Save the subject and review the exact sandboxed preview.
3. Approve the exact subject and deterministic HTML.
4. Clear the Subscriber delivery repair queue. Retry one unsynced captured address at a time. This
   admin retry never touches an address that already has a Resend contact ID, so it cannot override
   a provider-side unsubscribe.
5. Confirm Send newsletter. The server creates and persists a provider draft before issuing the
   separate send request.
6. If the outbox remains `sending` or `queued` and has a stored broadcast ID, use Reconcile
   provider. If no ID was recorded after an uncertain creation response, inspect Resend manually.
   Never click Send again or create a replacement after an uncertain response.

Broadcasts require `NEWSLETTER_POSTAL_ADDRESS` plus the configured Resend sender and segment. Every
broadcast includes the provider unsubscribe link. Delivery fails closed when any required value is
absent.

## Public distribution, search metadata, and privacy

- Share controls always use a permanent public URL. The rolling `/daily` page shares its immutable
  `/daily/YYYY-MM-DD` edition; native Web Share falls back to copying that URL, while email,
  LinkedIn, and X remain user-initiated links.
- Dated Daily metadata, Article/Breadcrumb structured data, and its social image are generated only
  after the same validated `daily_published` lookup as the page. An unpublished or malformed date
  returns 404 instead of exposing draft text through a preview image.
- `/rss.xml` contains verified Writing plus immutable Daily snapshots only. Publication revalidates
  the feed. Sitemap `lastmod` values come from real publication or curation instants; static pages
  omit the field rather than claiming the deployment time is a content edit.
- Base Vercel Web Analytics accepts pageviews only. The client boundary strips query strings and
  fragments, drops `/admin`, and rejects custom events. Search text and newsletter addresses are
  never analytics properties. Keep `/privacy` accurate before adding any new measurement tool.

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
or utility routes. `/daily` appears in the sitemap only after a valid published snapshot exists;
`/ai` and topic hubs appear only after their reviewed-content thresholds are met. Confirm unknown
topic slugs return a literal 404 and `/api/search` contains public kinds only.
Before exercising public POST routes, verify migration `0010_bent_susan_delgado.sql` is applied and
`PUBLIC_MUTATION_RATE_LIMIT_SECRET` is present in both Preview and Production. A missing prerequisite
must prevent subscriber/provider/submission writes, not silently bypass rate limiting.
