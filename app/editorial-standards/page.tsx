import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Editorial Standards",
  description:
    "How Engineerious sources, labels, and reviews content — including the automated daily research pipeline and its human approval gate.",
  alternates: { canonical: "/editorial-standards" },
};

export default function EditorialStandardsPage() {
  return (
    <div className="py-14 sm:py-20">
      <header className="max-w-2xl border-b border-rule pb-10">
        <p className="eyebrow">Editorial standards</p>
        <h1 className="font-display mt-3 text-balance text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">
          How this site decides what to publish and how to label it.
        </h1>
      </header>

      <section className="prose max-w-2xl py-10">
        <h2>Who publishes here</h2>
        <p>
          Engineerious is a single-operator site. Tharun Chowdary Malepati is the sole
          editor, and no piece goes live — automated or hand-written — without his
          direct approval. There is no separate editorial staff and no outside
          reviewer; this section exists so readers know exactly what that means in
          practice.
        </p>

        <h2>Every piece carries a provenance label</h2>
        <p>
          Every post on this site declares, in machine-checked metadata, four things:
        </p>
        <ul>
          <li>
            <strong>Origin</strong> — human-written, AI-assisted, or AI-generated
            first draft. This is not optional or self-reported after the fact; the
            content schema rejects a post that omits it.
          </li>
          <li>
            <strong>Source status</strong> — whether claims trace to primary sources,
            secondary reporting, or a mix.
          </li>
          <li>
            <strong>Tested status</strong> — whether a described technical claim was
            never independently tested, tested once, or independently repeated.
          </li>
          <li>
            <strong>Authenticity status</strong> — <em>pending</em> or{" "}
            <em>verified</em>. A post cannot be marked verified without both a named
            human reviewer and a timestamp attached — the schema enforces this, it
            isn&rsquo;t a style convention.
          </li>
        </ul>
        <p>
          You can see this provenance block at the top of every post — see, for
          example, any entry in the{" "}
          <Link href="/blog">blog</Link>.
        </p>

        <h2>The automated research pipeline</h2>
        <p>
          Engineerious runs a nightly pipeline that gathers AI news, research, and
          relevant market data, then drafts one long-form post a day. It has four
          stages: gather sources, synthesize findings with citations, write a draft in
          a fixed voice, and run an adversarial review pass that checks the draft
          against its own source findings and flags anything unsupported, hedgy, or
          generically AI-sounding.
        </p>
        <p>
          That review pass is a check, not a gate — it flags problems for a human to
          see, it does not approve anything itself.{" "}
          <strong>
            No pipeline output — post or newsletter — goes live without Tharun
            personally reviewing and approving it.
          </strong>{" "}
          The pipeline cannot set a post to published or mark it verified; only a
          human action in the admin queue can.
        </p>

        <h2>Ranking and sourcing</h2>
        <p>
          The news, model, and open-source feeds are ranked with a variant of Hacker
          News&rsquo;s ranking formula, weighted by source authority so a primary
          announcement from a lab can outrank a rewrite of it before either has a
          single vote. Feed items are links to the original source, not rewrites —
          Engineerious does not republish other outlets&rsquo; reporting as its own.
        </p>

        <h2>Disclosure of AI assistance</h2>
        <p>
          Where AI tools are used to draft or research a piece, that is disclosed in
          the post&rsquo;s provenance label, not buried in a footer. Human-written
          analysis and AI-assisted or AI-generated drafts are never presented under
          the same label.
        </p>

        <p>
          Questions about how a specific claim was sourced or labeled: see the{" "}
          <Link href="/corrections">corrections policy</Link> for how to reach out.
        </p>
      </section>
    </div>
  );
}
