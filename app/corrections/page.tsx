import type { Metadata } from "next";
import Link from "next/link";

import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Corrections Policy",
  description: "How Engineerious handles factual errors, updates, and corrections after publication.",
  alternates: { canonical: "/corrections" },
};

export default function CorrectionsPage() {
  return (
    <div className="py-14 sm:py-20">
      <header className="max-w-2xl border-b border-rule pb-10">
        <p className="eyebrow">Corrections policy</p>
        <h1 className="font-display mt-3 text-balance text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">
          Errors get fixed and marked, not quietly edited away.
        </h1>
      </header>

      <section className="prose max-w-2xl py-10">
        <h2>Reporting an error</h2>
        <p>
          If a post states something factually wrong — a misquoted number, a
          misattributed source, a claim that doesn&rsquo;t hold up — email{" "}
          {env.contactEmail ? (
            <a href={`mailto:${env.contactEmail}`}>{env.contactEmail}</a>
          ) : (
            "the contact address on the About page"
          )}{" "}
          with the post URL and what&rsquo;s wrong. Every report gets a reply.
        </p>

        <h2>What happens after a report</h2>
        <ul>
          <li>
            <strong>Factual error in a claim, number, or attribution:</strong> the
            post is corrected, and the post&rsquo;s last-modified date updates to
            reflect it. Substantive corrections — ones that change the meaning of a
            claim, not a typo — are noted inline in the piece.
          </li>
          <li>
            <strong>Outdated but not wrong when written</strong> (a tool changed
            pricing, a model was deprecated): treated as an update, not a correction,
            and handled the same way — noted, dated.
          </li>
          <li>
            <strong>Typo or formatting issue:</strong> fixed silently. These don&rsquo;t
            change what the post claims.
          </li>
        </ul>

        <h2>What doesn&rsquo;t happen</h2>
        <p>
          A published post is not unpublished to make an error disappear, and a
          correction is not backdated. If something was wrong, the record shows that
          it was wrong and when it was fixed. See{" "}
          <Link href="/editorial-standards">editorial standards</Link> for how posts
          are reviewed before publication in the first place.
        </p>
      </section>
    </div>
  );
}
