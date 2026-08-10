import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { PillarBadge } from "@/components/PillarBadge";
import { getAdjacentPosts, getAllPosts, getPost } from "@/lib/content/blog";
import { getPostRow } from "@/lib/content/sync";
import { env } from "@/lib/env";
import { longDate } from "@/lib/time";

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.dek,
    alternates: { canonical: post.canonical ?? `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.dek,
      url: `${env.siteUrl}/blog/${post.slug}`,
      publishedTime: post.date.toISOString(),
      tags: post.tags,
    },
  };
}

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  x: "X",
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
};

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  // Distribution links come from the DB and are optional — the article must render
  // fine on a machine with no DATABASE_URL.
  const row = await getPostRow(slug);
  const distribution = Object.entries(row?.distribution ?? {}).filter(([, url]) => Boolean(url));
  const { newer, older } = getAdjacentPosts(slug);

  return (
    <article className="space-y-7 py-8">
      <header className="space-y-3">
        <PillarBadge slug={post.pillar} />
        <h1 className="max-w-[68ch] text-[30px] font-bold leading-[1.15] tracking-tight">
          {post.title}
        </h1>
        <p className="max-w-[68ch] text-[16.5px] text-muted">{post.dek}</p>
        <p className="font-mono text-[12px] text-muted">
          {longDate(post.date)} · {post.readingMinutes} min read · Tharun Chowdary Malepati
        </p>
      </header>

      <div className="prose">
        <MDXRemote source={post.body} options={{ parseFrontmatter: false }} />
      </div>

      {post.tags.length > 0 && (
        <p className="font-mono text-[12px] text-muted">{post.tags.map((t) => `#${t}`).join(" ")}</p>
      )}

      {distribution.length > 0 && (
        <section className="border-t border-rule pt-5">
          <h2 className="font-mono text-[12px] uppercase tracking-wide text-muted">
            Distributed to
          </h2>
          <ul className="mt-1 flex flex-wrap gap-x-3 text-[13.5px]">
            {distribution.map(([platform, url]) => (
              <li key={platform}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {PLATFORM_LABELS[platform] ?? platform} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NewsletterCTA />

      <nav className="flex flex-wrap justify-between gap-4 border-t border-rule pt-5 font-mono text-[12.5px]">
        {older ? <Link href={`/blog/${older.slug}`}>← {older.title}</Link> : <span />}
        {newer ? <Link href={`/blog/${newer.slug}`}>{newer.title} →</Link> : <span />}
      </nav>
    </article>
  );
}
