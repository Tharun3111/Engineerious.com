import type { Metadata } from "next";

import { AuthorBadge } from "@/components/AuthorBadge";
import { NewsletterCTA } from "@/components/NewsletterCTA";
import { env } from "@/lib/env";
import { AUTHOR_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `About ${AUTHOR_NAME}`,
  description:
    "Tharun Chowdary Malepati is an AI and machine learning engineer focused on generative AI, agentic systems, retrieval, evaluation, and AI infrastructure.",
  alternates: { canonical: "/about" },
};

const interestGroups = [
  {
    label: "LLM systems",
    items: ["LLM applications", "RAG", "AI agents", "multi-agent systems", "MCP", "A2A"],
  },
  {
    label: "Retrieval and quality",
    items: ["embeddings", "retrieval", "reranking", "LLM evaluation", "AI observability"],
  },
  {
    label: "Adaptation and inference",
    items: ["fine-tuning", "LoRA and QLoRA", "PEFT", "quantization", "vLLM", "GPU inference"],
  },
  {
    label: "Application engineering",
    items: ["Python", "FastAPI", "LangChain", "LangGraph", "AutoGen", "vector databases"],
  },
] as const;

export default function AboutPage() {
  return (
    <div className="py-10 sm:py-14">
      <header className="border-b border-fg pb-10 sm:pb-12">
        <div className="flex items-center gap-3">
          <AuthorBadge size="lg" />
          <p className="eyebrow">About</p>
        </div>
        <h1 className="font-display mt-5 max-w-[24ch] text-balance text-[28px] font-semibold leading-[1.2] tracking-[-0.03em] sm:text-[38px]">
          {AUTHOR_NAME}
        </h1>
        <p className="mt-4 max-w-[64ch] text-[18px] leading-8 text-muted">
          AI / Machine Learning Engineer focused increasingly on generative AI and
          agentic AI systems.
        </p>
        <p className="mt-3 max-w-[66ch] text-[15.5px] leading-7">
          I&rsquo;m interested in how LLM applications, retrieval, agents, evaluation,
          and inference infrastructure fit together as real engineering systems.
        </p>
      </header>

      <div className="grid gap-12 py-12 lg:grid-cols-[minmax(0,42rem)_minmax(16rem,1fr)] lg:gap-16 lg:py-16">
        <article className="prose order-2 lg:order-1">
          <section aria-labelledby="who-i-am">
            <h2 id="who-i-am">Who I am</h2>
            <p>
              My name is Tharun Chowdary Malepati. I work in AI and machine learning
              engineering, with a growing focus on generative AI and agentic systems.
              Engineerious is the public desk where I can organize what I&rsquo;m building,
              what I&rsquo;m ready to explain, and the questions I want to keep working on.
            </p>
            <blockquote>
              <p>Engineer first. Curator second. Creator always.</p>
            </blockquote>
          </section>

          <section aria-labelledby="what-i-work-on">
            <h2 id="what-i-work-on">What I work on</h2>
            <p>
              My interests span the full path from a model call to a system someone can
              operate and evaluate. These are the areas currently on the desk:
            </p>
            <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-2">
              {interestGroups.map((group) => (
                <div key={group.label} className="bg-surface p-5">
                  <dt className="section-label text-fg">{group.label}</dt>
                  <dd className="mt-2 text-[14px] leading-6 text-muted">
                    {group.items.join(" · ")}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="trying-to-understand">
            <h2 id="trying-to-understand">What I&rsquo;m trying to understand</h2>
            <p>
              I care about the gap between a clean AI demo and a useful system. How
              should retrieval be designed? When does an agent architecture earn its
              complexity? How do we evaluate behavior instead of admiring one good run?
              What changes when latency, cost, observability, and inference enter the
              picture?
            </p>
            <p>
              Those questions matter more to me than repeating every announcement. They
              also give this site its shape.
            </p>
          </section>

          <section aria-labelledby="why-i-write">
            <h2 id="why-i-write">Why I write</h2>
            <p>
              Learning becomes stronger when I can explain it simply. I want a useful
              entry to go beyond what happened and answer why it matters, how it works,
              who should care, and what an engineer should take away from it.
            </p>
            <p>
              That means leaving room for uncertainty, mistakes, tradeoffs, and opinions.
              It also means being clear about what I tested, what I only researched, and
              what still needs work.
            </p>
          </section>

          <section aria-labelledby="what-you-will-find">
            <h2 id="what-you-will-find">What you&rsquo;ll find here</h2>
            <ul>
              <li>Reviewed writing about AI engineering and system design.</li>
              <li>Daily intelligence and curated developments as they are approved.</li>
              <li>Project case studies centered on architecture and decisions.</li>
              <li>Practical notes on concepts, models, and frameworks when the material is ready.</li>
            </ul>
          </section>

          <section aria-labelledby="publishing-standard">
            <h2 id="publishing-standard">Publishing standard</h2>
            <ul>
              <li>AI-generated work stays unpublished until a named human reviews it.</li>
              <li>Reported, tested, and opinionated claims remain distinct.</li>
              <li>Primary sources and reproducible details are preferred.</li>
              <li>Unconfirmed projects and personal experience do not become placeholder copy.</li>
              <li>Corrections are part of the record.</li>
            </ul>
          </section>
        </article>

        <aside
          id="connect"
          aria-labelledby="connect-heading"
          className="order-1 h-fit border-y border-rule py-7 lg:order-2 lg:border-b-0 lg:border-l lg:border-t-0 lg:py-0 lg:pl-8"
        >
          <p className="section-label">Connect</p>
          <h2 id="connect-heading" className="font-display mt-3 text-[22px] font-semibold leading-tight">
            Find me elsewhere
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-muted">
            Only configured profiles appear here. No placeholder accounts, handles, or
            contact details.
          </p>
          <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap lg:flex-col">
            {env.contactEmail && (
              <a href={`mailto:${env.contactEmail}`} className="btn btn-primary btn-sm">
                Email Tharun
              </a>
            )}
            {env.githubUrl && (
              <a
                href={env.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                GitHub <span aria-hidden>↗</span>
              </a>
            )}
            {env.linkedinUrl && (
              <a
                href={env.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                LinkedIn <span aria-hidden>↗</span>
              </a>
            )}
          </div>
          {!env.contactEmail && !env.linkedinUrl && !env.githubUrl && (
            <p className="mt-5 rounded-md bg-surface-2 p-4 text-[14px] leading-6 text-muted">
              Contact links have not been configured yet.
            </p>
          )}
        </aside>
      </div>

      <NewsletterCTA
        heading="Follow the engineering desk"
        blurb="New writing is sent only after it has been reviewed and published."
      />
    </div>
  );
}
