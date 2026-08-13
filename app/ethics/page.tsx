import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Code of Ethics",
  description: "Engineerious's conflict-of-interest, sourcing, and independence commitments.",
  alternates: { canonical: "/ethics" },
};

export default function EthicsPage() {
  return (
    <div className="py-14 sm:py-20">
      <header className="max-w-2xl border-b border-rule pb-10">
        <p className="eyebrow">Code of ethics</p>
        <h1 className="font-display mt-3 text-balance text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">
          No paid placement. No hidden stake. No exceptions.
        </h1>
      </header>

      <section className="prose max-w-2xl py-10">
        <h2>No pay-for-coverage</h2>
        <p>
          Nothing on this site is published, ranked, or featured because someone paid
          for it. Engineerious carries no sponsors and no advertising. If that ever
          changes, sponsored content will be labeled as such in the post itself, not
          disclosed only in a footer or terms page.
        </p>

        <h2>Conflicts of interest</h2>
        <p>
          Tharun Chowdary Malepati builds AI engineering tools, including Doctor Bot
          and Observo. When a post discusses a product or project he has a stake in —
          his own or someone else&rsquo;s — that stake is disclosed in the post, not
          left for the reader to discover elsewhere.
        </p>

        <h2>Independence of the automated pipeline</h2>
        <p>
          The nightly research pipeline that drafts Engineerious&rsquo;s daily post is
          not instructed to favor any company, tool, or narrative. It is instructed to
          find what actually happened in AI news, research, and markets that day and
          write it plainly. See{" "}
          <Link href="/editorial-standards">editorial standards</Link> for exactly how
          that pipeline works and what stops it from publishing unchecked.
        </p>

        <h2>Sourcing</h2>
        <p>
          Primary sources — the lab, the paper, the repository, the filing — are
          preferred over secondary write-ups of them. Where only a secondary source is
          available, that&rsquo;s stated rather than implied to be primary.
        </p>

        <h2>Corrections</h2>
        <p>
          Mistakes are fixed and marked, not quietly edited away. See the{" "}
          <Link href="/corrections">corrections policy</Link>.
        </p>
      </section>
    </div>
  );
}
