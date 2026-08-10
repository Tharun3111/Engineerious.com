import type { Metadata } from "next";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { SocialLinks } from "@/components/SocialLinks";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "About Tharun",
  description:
    "About Tharun Chowdary and Engineerious, a public notebook for practical AI engineering.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="space-y-10 py-10 sm:py-14">
      <header className="max-w-3xl space-y-4">
        <p className="eyebrow">About Tharun</p>
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.025em] sm:text-[44px]">
          Learning how AI systems behave outside the demo.
        </h1>
        <p className="max-w-2xl text-[17px] leading-relaxed text-muted">
          I&rsquo;m Tharun Chowdary. Engineerious is where I turn practical AI
          engineering work into explanations, field notes, and reusable lessons.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,42rem)_1fr]">
        <section className="prose">
          <h2>What this site is for</h2>
          <p>
            AI engineering changes quickly, but reliable systems still depend on clear
            questions: What did we test? What failed? Which evidence supports the
            claim? What would make us change our mind?
          </p>
          <p>
            I use Engineerious to work through those questions across evaluation,
            agents and MCP, retrieval, models, and production reliability. The goal is
            useful technical judgment, not a high-volume news publication.
          </p>

          <h2>Publishing standard</h2>
          <ul>
            <li>First-person claims are reviewed before publication.</li>
            <li>Reported, tested, and opinionated claims are kept distinct.</li>
            <li>AI-generated or AI-assisted published text is disclosed.</li>
            <li>Primary sources and reproducible details are preferred.</li>
            <li>Corrections are part of the work, not an embarrassment to hide.</li>
          </ul>

          <h2>What is coming next</h2>
          <p>
            The first articles are being audited now. Automated feeds remain private
            research tooling until they prove they improve the original work without
            consuming the writing budget.
          </p>
        </section>

        <aside id="contact" className="space-y-5">
          <div className="card p-6">
            <p className="section-label">Work with me</p>
            <h2 className="mt-2 text-[20px] font-semibold">Open to useful conversations</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              AI engineering roles, collaborations, technical writing, and practical
              systems work are all good reasons to reach out.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {env.contactEmail && (
                <a href={`mailto:${env.contactEmail}`} className="btn btn-primary btn-sm">
                  Email Tharun
                </a>
              )}
              {env.linkedinUrl && (
                <a
                  href={env.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  LinkedIn ↗
                </a>
              )}
            </div>
            {!env.contactEmail && !env.linkedinUrl && (
              <p className="mt-4 text-[13px] text-muted">
                Direct contact details will appear here once the production profiles
                are connected.
              </p>
            )}
            <SocialLinks className="mt-4" />
          </div>
        </aside>
      </div>

      <NewsletterCTA />
    </div>
  );
}
