import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FeedList } from "@/components/FeedList";
import type { Item, ItemType } from "@/db/schema";
import { getArchiveDay } from "@/lib/content/archive";
import { env } from "@/lib/env";
import { SECTIONS } from "@/lib/sections";
import { longDate } from "@/lib/time";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  const day = await getArchiveDay(date);
  if (!day) return {};

  return {
    title: `Archive — ${date}`,
    description: `What published on Engineerious on ${date}.`,
    alternates: { canonical: `/archive/${date}` },
  };
}

function groupByType(items: Item[]): Record<ItemType, Item[]> {
  const groups = { news: [], model: [], oss: [] } as Record<ItemType, Item[]>;
  for (const item of items) groups[item.type].push(item);
  return groups;
}

export default async function ArchiveDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const day = await getArchiveDay(date);
  if (!day) notFound();

  const site = env.siteUrl.replace(/\/$/, "");
  const grouped = groupByType(day.items);

  return (
    <div className="space-y-10 py-12 sm:py-16">
      <header className="border-b border-fg pb-8">
        <p className="eyebrow">
          <Link href="/archive" className="hover:text-accent-strong">
            Archive
          </Link>{" "}
          / {date}
        </p>
        <h1 className="font-display mt-3 text-balance text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">
          {longDate(new Date(`${date}T00:00:00Z`))}
        </h1>
      </header>

      {day.posts.length > 0 && (
        <section aria-labelledby="archive-day-blog-heading" className="space-y-4">
          <h2 id="archive-day-blog-heading" className="section-label">
            Blog
          </h2>
          <ul className="space-y-6">
            {day.posts.map((post) => (
              // This page is self-canonical (see generateMetadata above) — it shows only
              // a summary + link, not the full post body, so it's distinct content from
              // /blog/[slug] rather than a duplicate needing to canonicalize there.
              <li key={post.slug} className="border border-rule p-5">
                <h3 className="text-[20px] font-semibold leading-snug">
                  <Link href={`/blog/${post.slug}`} className="hover:text-accent-strong">
                    {post.title}
                  </Link>
                </h3>
                <p className="mt-1.5 text-[15px] text-muted">{post.dek}</p>
                {post.tldr && (
                  <p className="mt-3 border-t border-rule pt-3 text-[14.5px] leading-6">
                    <span className="eyebrow mr-2">TL;DR</span>
                    {post.tldr}
                  </p>
                )}
                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-3 inline-block font-mono text-[12.5px] text-accent-strong hover:underline"
                >
                  Read the full post → {site}/blog/{post.slug}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {SECTIONS.map((section) => {
        const sectionItems = grouped[section.type];
        if (sectionItems.length === 0) return null;
        return (
          <section key={section.type} aria-labelledby={`archive-day-${section.type}-heading`} className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id={`archive-day-${section.type}-heading`} className="section-label">
                {section.label}
              </h2>
              <Link href={section.path} className="font-mono text-[12px] text-muted hover:text-accent-strong">
                View all {section.label.toLowerCase()} →
              </Link>
            </div>
            {/* Already grouped under a per-type heading above — the pill would
             *  repeat it on every row. */}
            <FeedList items={sectionItems} showType={false} />
          </section>
        );
      })}
    </div>
  );
}
