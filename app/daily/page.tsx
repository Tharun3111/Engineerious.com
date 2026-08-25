import type { Metadata } from "next";
import Link from "next/link";

import { EvidenceRail } from "@/components/EvidenceRail";

export const metadata: Metadata = {
  title: "Daily AI Brief",
  description:
    "Engineerious is preparing a reviewed daily AI engineering brief with sources, practical implications, and Tharun's take.",
  alternates: { canonical: "/daily" },
  robots: { index: false, follow: true },
};

/**
 * Phase-one route foundation. This stays intentionally unindexed until the
 * structured, human-reviewed Daily workflow lands; an empty archive should not
 * masquerade as a publication.
 */
export default function DailyFoundationPage() {
  return (
    <div className="mx-auto max-w-4xl py-10 sm:py-14">
      <header className="border-b border-fg pb-8">
        <p className="eyebrow">Daily intelligence</p>
        <h1 className="font-display mt-3 max-w-[24ch] text-balance text-[28px] font-semibold leading-[1.25] tracking-[-0.03em] sm:text-[38px]">
          The useful part of today&rsquo;s AI changes, after review.
        </h1>
        <p className="mt-4 max-w-[62ch] text-[16px] leading-7 text-muted">
          The Daily Brief is being built as a separate reviewed publication &mdash; not
          as another stream of machine-written news. No brief is public until its
          sources, significance, and personal take have been checked.
        </p>
      </header>

      <div className="py-8">
        <EvidenceRail compact />
      </div>

      <section className="border-y border-rule py-8">
        <p className="section-label">Publication status</p>
        <h2 className="font-display mt-2 text-[20px] font-semibold leading-snug">
          No reviewed daily brief is published yet.
        </h2>
        <p className="mt-3 max-w-[58ch] text-[15px] leading-7 text-muted">
          Until the first one clears editorial review, the useful material already on
          the desk remains in Writing.
        </p>
        <Link href="/blog" className="btn btn-secondary mt-5">
          Read the writing
        </Link>
      </section>
    </div>
  );
}
