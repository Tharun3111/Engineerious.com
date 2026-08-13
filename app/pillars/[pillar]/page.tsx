import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { getPostsByPillar } from "@/lib/content/blog";
import { getPillar, PILLARS } from "@/lib/pillars";
import { isoDate } from "@/lib/time";

export function generateStaticParams() {
  return PILLARS.map((pillar) => ({ pillar: pillar.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pillar: string }>;
}): Promise<Metadata> {
  const { pillar: slug } = await params;
  const pillar = getPillar(slug);
  if (!pillar) return {};
  return {
    title: pillar.name,
    description: pillar.tagline,
    alternates: { canonical: `/pillars/${pillar.slug}` },
  };
}

export default async function PillarPage({ params }: { params: Promise<{ pillar: string }> }) {
  const { pillar: slug } = await params;
  const pillar = getPillar(slug);
  if (!pillar) notFound();

  const posts = await getPostsByPillar(pillar.slug);

  return (
    <div className="space-y-8 py-8">
      <header className="max-w-2xl space-y-2">
        <p className="eyebrow">Pillar</p>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight">{pillar.name}</h1>
        <p className="text-[15px] text-muted">{pillar.tagline}</p>
        <p className="text-[14.5px]">{pillar.description}</p>
      </header>

      <section>
        <h2 className="section-label">Posts</h2>
        {posts.length === 0 ? (
          <div className="mt-2 card p-5 text-[13.5px] text-muted">
            <p>No articles in this topic yet.</p>
            <Link href="/blog" className="mt-3 inline-flex font-semibold text-fg underline underline-offset-4">
              Browse all engineering guides
            </Link>
          </div>
        ) : (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2">
            {posts.map((post) => (
              <li key={post.slug} className="card card-hover p-5">
                <Link href={`/blog/${post.slug}`} className="text-[16px] font-semibold hover:text-accent-strong">
                  {post.title}
                </Link>
                <p className="mt-1.5 text-[13.5px] text-muted">{post.dek}</p>
                <p className="mt-3 font-mono text-[11.5px] text-muted">
                  {isoDate(post.date)} · {post.readingMinutes} min read
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="Other pillars" className="border-t border-rule pt-5">
        <p className="section-label mb-2">Other pillars</p>
        <ul className="flex flex-wrap gap-2">
          {PILLARS.filter((p) => p.slug !== pillar.slug).map((p) => (
            <li key={p.slug}>
              <Link href={`/pillars/${p.slug}`} className="pill hover:border-accent hover:text-accent-strong">
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <NewsletterCTA />
    </div>
  );
}
