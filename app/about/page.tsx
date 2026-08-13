import type { Metadata } from "next";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { SocialLinks } from "@/components/SocialLinks";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "About Tharun",
  description:
    "Meet Tharun Chowdary and learn how Engineerious reviews AI news, models, and production engineering lessons.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="py-14 sm:py-20">
      <header className="grid gap-6 border-b border-rule pb-12 lg:grid-cols-[18rem_1fr] lg:pb-16">
        <p className="eyebrow">About Tharun</p>
        <div>
          <h1 className="font-display max-w-3xl text-balance text-[46px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[62px]">
            Turning AI engineering work into useful public knowledge.
          </h1>
          <p className="mt-6 max-w-2xl text-[19px] leading-8 text-muted">
          I&rsquo;m Tharun Chowdary — a founder and engineer, and genuinely
          passionate about both. Engineerious is where I turn practical AI
          engineering work into explanations, field notes, and reusable lessons.
          </p>
        </div>
      </header>

      <div className="grid gap-14 py-14 lg:grid-cols-[minmax(0,42rem)_1fr] lg:py-20">
        <section className="prose order-2 lg:order-1">
          <h2>Why Engineerious exists</h2>
          <p>
            AI moves faster than anyone can casually keep up with — new models,
            new failure modes, new tooling every week. I didn&rsquo;t want to
            fall behind, so I built Engineerious: a system that forces me to
            stay current, test what I read instead of just skimming it, and
            turn that work into something useful for other engineers instead
            of leaving it in my own notes.
          </p>

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

          <h2>What comes next</h2>
          <p>
            I&rsquo;m expanding the engineering blog, publishing focused model comparisons,
            and improving the research workflow behind each article. Automated feeds stay
            behind human review so speed never replaces judgment.
          </p>
        </section>

        <aside id="contact" className="order-1 border-y border-rule py-7 lg:order-2 lg:border-b-0 lg:border-l lg:border-t-0 lg:py-0 lg:pl-8">
            <p className="section-label">Work with me</p>
            <h2 className="font-display mt-3 text-[28px] font-semibold leading-tight">Let&rsquo;s work on useful AI systems</h2>
            <p className="mt-4 text-[16px] leading-7 text-muted">
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
              <p className="mt-4 text-[15px] leading-6 text-muted">
                Contact links aren&rsquo;t available yet. Check back soon.
              </p>
            )}
            <SocialLinks className="mt-4" />
        </aside>
      </div>

      <NewsletterCTA heading="Get the next engineering guide" />
    </div>
  );
}
