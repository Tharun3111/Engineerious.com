import type { Metadata } from "next";
import Link from "next/link";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { PillarBadge } from "@/components/PillarBadge";
import { RESOURCE_TYPE_LABEL, RESOURCES } from "@/lib/resources";

export const metadata: Metadata = {
  title: "Free resources",
  description:
    "Guides, templates, and cheatsheets for eval-first AI engineering, MCP in production, and production RAG — free, no signup.",
  alternates: { canonical: "/resources" },
};

export default function ResourcesPage() {
  return (
    <div className="space-y-8 py-8">
      <header className="max-w-2xl space-y-2">
        <p className="eyebrow">Free resources</p>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight">
          Guides and templates for reliable AI systems
        </h1>
        <p className="text-[15px] text-muted">
          Use these practical checklists and templates without signing up. Each one
          comes from production work, including the parts that needed a rewrite.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {RESOURCES.map((resource) => (
          <li key={resource.slug} className="card card-hover flex flex-col p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill pill-accent">{RESOURCE_TYPE_LABEL[resource.type]}</span>
              {resource.pillar && <PillarBadge slug={resource.pillar} />}
            </div>

            <h2 className="mt-3 text-[16.5px] font-semibold leading-snug">
              {resource.comingSoon ? (
                <span>{resource.title}</span>
              ) : (
                <Link href={resource.url} className="hover:text-accent-strong hover:underline">
                  {resource.title}
                </Link>
              )}
            </h2>
            <p className="mt-1.5 flex-1 text-[13.5px] text-muted">{resource.description}</p>

            <div className="mt-4">
              {resource.comingSoon ? (
                <span className="pill">Coming soon</span>
              ) : (
                <Link href={resource.url} className="btn btn-secondary btn-sm">
                  View resource →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>

      <NewsletterCTA
        heading="Get new resources first"
        blurb="New guides and templates land in the newsletter before they land here."
      />
    </div>
  );
}
