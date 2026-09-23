import { sql, type SQL } from "drizzle-orm";

import type { ContentSourceStatus } from "@/lib/editorial-safety";

/**
 * One-statement web publication with a serialized digest decision.
 *
 * The row lock is load-bearing: without it, a concurrent reject can commit after
 * `eligible` is read but before the final digest update, allowing approve to
 * overwrite a terminal rejection. The final status predicate is a second guard
 * for PostgreSQL's EvalPlanQual recheck after any lock wait.
 */
export function buildDigestPublishStatement(input: {
  id: number;
  reviewerName: string;
  now: Date;
  editorialDate: Date;
  sourceStatus: ContentSourceStatus;
}): SQL {
  return sql`
    with eligible as materialized (
      select id, blog_post_slug
        from digests
       where id = ${input.id}
         and status in ('pending_review', 'approved')
         and blog_post_slug is not null
         for update
    ), published_post as (
      update posts
         set draft = false,
             authenticity_status = 'verified',
             source_status = ${input.sourceStatus},
             reviewed_by = ${input.reviewerName},
             reviewed_at = ${input.now},
             published_at = ${input.editorialDate},
             updated_at = ${input.now}
        from eligible
       where posts.slug = eligible.blog_post_slug
      returning posts.slug, eligible.id as digest_id
    )
    update digests
       set status = 'published',
           published_at = ${input.now},
           reviewed_by = ${input.reviewerName},
           reviewed_at = ${input.now},
           error = null,
           updated_at = ${input.now}
      from published_post
     where digests.id = published_post.digest_id
       and digests.status in ('pending_review', 'approved')
    returning published_post.slug
  `;
}
