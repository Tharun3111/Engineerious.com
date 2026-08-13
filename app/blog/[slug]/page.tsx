import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";

import { Diagram } from "@/components/Diagram";
import { JsonLd } from "@/components/JsonLd";
import { KeyFacts } from "@/components/KeyFacts";
import { NewsletterCTA } from "@/components/NewsletterCTA";
import { PillarBadge } from "@/components/PillarBadge";
import { ShareExcerpt } from "@/components/ShareExcerpt";
import { StockStrip } from "@/components/StockStrip";
import { TLDR } from "@/components/TLDR";
import { getAdjacentPosts, getAllPosts, getPost, isVisible, type BlogPost } from "@/lib/content/blog";
import { getPostRow } from "@/lib/content/sync";
import { env } from "@/lib/env";
import { AUTHOR_NAME, SITE_NAME } from "@/lib/site";
import { getStockStripQuotes } from "@/lib/stocks";
import { longDate } from "@/lib/time";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post || !isVisible(post)) return {};

  const site = env.siteUrl.replace(/\/$/, "");

  return {
    title: post.title,
    description: post.dek,
    alternates: { canonical: post.canonical ?? `/blog/${post.slug}` },
    authors: [{ name: AUTHOR_NAME }],
    openGraph: {
      type: "article",
      title: post.title,
      description: post.dek,
      url: `${site}/blog/${post.slug}`,
      publishedTime: post.date.toISOString(),
      authors: [AUTHOR_NAME],
      tags: post.tags,
    },
  };
}

function blogPostingJsonLd(post: BlogPost) {
  const site = env.siteUrl.replace(/\/$/, "");
  const permalink = `${site}/blog/${post.slug}`;
  // Structured data must describe the same resource the page's own canonical
  // link points to — falling back to the permalink only when the post has no
  // canonical override, mirroring generateMetadata()'s alternates.canonical.
  const canonicalUrl = post.canonical ?? permalink;
  // post.date IS the publish date for both sources: author-set in MDX
  // frontmatter, or posts.publishedAt for DB-native pipeline posts (set at
  // approval time — see app/api/admin/digests/route.ts). No separate last-edit
  // tracking exists past that, so dateModified names the same moment rather
  // than implying an edit that isn't tracked anywhere.
  const publishedAt = post.date.toISOString();
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.dek,
    datePublished: publishedAt,
    dateModified: publishedAt,
    image: `${permalink}/opengraph-image`,
    keywords: post.tags.length > 0 ? post.tags.join(", ") : undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    author: { "@type": "Person", name: AUTHOR_NAME, url: `${site}/about` },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${site}/icon.svg` },
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
  const post = await getPost(slug);
  if (!post || !isVisible(post)) notFound();

  // Distribution links come from the DB and are optional — the article must render
  // fine on a machine with no DATABASE_URL.
  const row = await getPostRow(slug);
  const distribution = Object.entries(row?.distribution ?? {}).filter(([, url]) => Boolean(url));
  const { newer, older } = await getAdjacentPosts(slug);
  const stockQuotes = await getStockStripQuotes(slug, post.relevantTickers ?? []);

  return (
    <article className="space-y-7 py-8">
      <JsonLd data={blogPostingJsonLd(post)} />
      <header className="space-y-3">
        <PillarBadge slug={post.pillar} />
        <h1 className="max-w-[68ch] text-[30px] font-bold leading-[1.15] tracking-tight">
          {post.title}
        </h1>
        <p className="max-w-[68ch] text-[16.5px] text-muted">{post.dek}</p>
        <p className="font-mono text-[12px] text-muted">
          {longDate(post.date)} · {post.readingMinutes} min read · {AUTHOR_NAME}
        </p>
        <div className="max-w-[68ch] border-y border-rule py-3 text-[13.5px] leading-6 text-muted">
          <p>
            <span className="font-semibold text-fg">Provenance:</span>{" "}
            {post.origin === "human"
              ? "Human-written."
              : post.origin === "ai_assisted"
                ? "Written with disclosed AI assistance."
                : "AI-generated first draft."}{" "}
            {post.testedStatus === "not_tested"
              ? "The claims were not independently tested by Engineerious."
              : post.testedStatus === "tested_once"
                ? "The described test was run once."
                : "The described test was independently repeated."}
          </p>
          {post.reviewedBy && post.reviewedAt && (
            <p>
              Reviewed by {post.reviewedBy} on {longDate(post.reviewedAt)}.
            </p>
          )}
        </div>
      </header>

      <TLDR text={post.tldr} />
      <KeyFacts items={post.keyFacts} />
      <StockStrip quotes={stockQuotes} />

      <div className="prose">
        <MDXRemote source={post.body} options={{ parseFrontmatter: false }} />
      </div>

      {/* key={post.slug}: forces a remount on navigation between posts — belt-and-
          suspenders alongside Diagram's own internal state reset, since App Router
          reuses this component's instance/state across sibling dynamic-route
          navigations by default. */}
      <Diagram key={post.slug} spec={post.diagram} />

      {post.tags.length > 0 && (
        <p className="font-mono text-[12px] text-muted">{post.tags.map((t) => `#${t}`).join(" ")}</p>
      )}

      <ShareExcerpt dek={post.dek} url={post.canonical ?? `${env.siteUrl.replace(/\/$/, "")}/blog/${post.slug}`} />

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
