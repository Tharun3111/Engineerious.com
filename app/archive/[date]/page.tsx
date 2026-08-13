import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getArchiveDay } from "@/lib/content/archive";
import { env } from "@/lib/env";
import { longDate } from "@/lib/time";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  const posts = await getArchiveDay(date);
  if (!posts) return {};

  return {
    title: `Archive — ${date}`,
    description: `What published on Engineerious on ${date}.`,
    alternates: { canonical: `/archive/${date}` },
  };
}

export default async function ArchiveDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const posts = await getArchiveDay(date);
  if (!posts) notFound();

  const site = env.siteUrl.replace(/\/$/, "");

  return (
    <div className="space-y-8 py-12 sm:py-16">
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

      <ul className="space-y-6">
        {posts.map((post) => (
          // This page is self-canonical (see generateMetadata above) — it shows only a
          // summary + link, not the full post body, so it's distinct content from
          // /blog/[slug] rather than a duplicate needing to canonicalize there.
          <li key={post.slug} className="border border-rule p-5">
            <h2 className="text-[20px] font-semibold leading-snug">
              <Link href={`/blog/${post.slug}`} className="hover:text-accent-strong">
                {post.title}
              </Link>
            </h2>
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
    </div>
  );
}
