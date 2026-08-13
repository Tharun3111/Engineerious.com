import Link from "next/link";
import { notFound } from "next/navigation";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { hostname } from "@/lib/dedupe";
import { getItem } from "@/lib/queries";
import { computeScore, ageHours } from "@/lib/ranking";
import { sectionFor } from "@/lib/sections";
import { timeAgo } from "@/lib/time";
import type { ItemType } from "@/db/schema";

/**
 * Item detail. Engineerious rows point outward, so this page exists for three
 * reasons: a stable internal permalink, the provenance of the row (which adapter,
 * which score), and somewhere to hang discussion later. The outbound link is the
 * primary action, not a footnote.
 */
export async function ItemDetail({ id, expectedType }: { id: string; expectedType: ItemType }) {
  const numericId = Number.parseInt(id, 10);
  if (!Number.isFinite(numericId)) notFound();

  const item = await getItem(numericId);
  if (!item || item.type !== expectedType || item.status !== "approved") notFound();

  const section = sectionFor(item.type);
  const raw = (item.rawJson ?? {}) as Record<string, unknown>;
  const discussion = typeof raw.discussion === "string" ? raw.discussion : null;
  const age = ageHours(item);
  const liveScore = computeScore({
    points: item.points,
    sourceWeight: item.sourceWeight,
    publishedAt: item.publishedAt,
    firstSeen: item.firstSeen,
  });

  return (
    <article className="space-y-6 py-8">
      <p className="font-mono text-[12px] text-muted">
        <Link href={section.path} className="hover:text-fg">{section.label}</Link> / #{item.id}
      </p>

      <div>
        <span className="pill">{section.label}</span>
        <h1 className="mt-2 text-[24px] font-bold leading-snug tracking-tight">{item.title}</h1>
        <p className="mt-1.5 font-mono text-[12.5px] text-muted">
          {item.source}
          {item.author ? ` · ${item.author}` : ""} ·{" "}
          {timeAgo(item.publishedAt ?? item.firstSeen)}
          {item.points > 0 ? ` · ${item.points} points` : ""}
        </p>
      </div>

      {item.summary && <p className="max-w-[68ch] text-[15px]">{item.summary}</p>}

      {item.aiNote && (
        <p className="card max-w-[68ch] p-4 text-[14px]">
          <span className="mr-1.5 font-mono text-[11px] uppercase tracking-wide text-accent-strong">
            AI-generated note
          </span>
          {item.aiNote}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="btn btn-primary"
        >
          Open on {hostname(item.url) || "source"} ↗
        </a>
        {discussion && (
          <a href={discussion} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            Hacker News discussion ↗
          </a>
        )}
      </div>

      <section className="card p-5">
        <h2 className="section-label">Source and ranking details</h2>
        <dl className="mt-2 grid grid-cols-[10rem_1fr] gap-y-1 font-mono text-[12.5px]">
          <dt className="text-muted">Source adapter</dt>
          <dd>{item.sourceSlug}</dd>
          <dt className="text-muted">Source weight</dt>
          <dd>{item.sourceWeight}</dd>
          <dt className="text-muted">Points</dt>
          <dd>{item.points}</dd>
          <dt className="text-muted">Age</dt>
          <dd>{age.toFixed(1)} h</dd>
          <dt className="text-muted">Stored score</dt>
          <dd>{item.score.toFixed(5)}</dd>
          <dt className="text-muted">Current score</dt>
          <dd>{liveScore.toFixed(5)}</dd>
          <dt className="text-muted">First seen</dt>
          <dd>{item.firstSeen.toISOString()}</dd>
        </dl>
      </section>

      <NewsletterCTA variant="compact" />
    </article>
  );
}
