import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";

import { Diagram } from "@/components/Diagram";
import { JsonLd } from "@/components/JsonLd";
import { KeyFacts } from "@/components/KeyFacts";
import { NewsletterCTA } from "@/components/NewsletterCTA";
import { Plate, plateStateFor } from "@/components/Plate";
import { ShareExcerpt } from "@/components/ShareExcerpt";
import { StockStrip } from "@/components/StockStrip";
import { TLDR } from "@/components/TLDR";
import { getAdjacentPosts, getAllPosts, getPost, isVisible, type BlogPost } from "@/lib/content/blog";
import { getPostRow } from "@/lib/content/sync";
import { env } from "@/lib/env";
import { AUTHOR_NAME, SITE_NAME } from "@/lib/site";
import { getStockStripQuotes } from "@/lib/stocks";
import { getPillar } from "@/lib/pillars";
import { isoDate } from "@/lib/time";

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
      {/* The record: plate first, then the strip. Everything is centred on the
          reading measure — the old header pinned a 68ch column to the left of a
          1280px shell and left 543px of empty page beside it. */}
      <header className="mx-auto max-w-[68ch]">
        <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted">
          {post.pillar && getPillar(post.pillar) ? `${getPillar(post.pillar)!.name} · ` : ""}
          {isoDate(post.date)}
        </p>
        <h1 className="font-display mt-3 text-balance text-[38px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[44px]">
          {post.title}
        </h1>
        <p className="font-display mt-4 text-[19px] leading-[1.55] text-muted">{post.dek}</p>

        {/* Reproduction outranks everything else on the page, by design. */}
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          <Plate
            size="lg"
            state={plateStateFor(post)}
            on={post.reviewedAt ?? null}
            by={post.reviewedBy ?? null}
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
            {post.readingMinutes} min read
          </span>
        </div>

        {/* One row of facts, so a label/value strip — never a table. Tables are
            for the index, where comparison across rows is the job. */}
        <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-rule py-5 sm:grid-cols-4">
          <div>
            <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.11em] text-muted">Origin</dt>
            <dd className="ver mt-1.5 text-fg">
              {post.origin === "human" ? "Human" : post.origin === "ai_assisted" ? "AI-assisted" : "AI draft"}
            </dd>
          </div>
          <div>
            <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.11em] text-muted">Sources</dt>
            <dd className="ver mt-1.5 text-fg">{post.sourceStatus}</dd>
          </div>
          <div>
            <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.11em] text-muted">Tested</dt>
            <dd className="ver mt-1.5 text-fg">{post.testedStatus.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.11em] text-muted">Reviewed</dt>
            <dd className="ver mt-1.5 text-fg">
              {post.reviewedAt ? isoDate(post.reviewedAt) : "\u2014"}
            </dd>
          </div>
        </dl>
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
