import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/JsonLd";
import { getProject, projects } from "@/lib/projects";
import { AUTHOR_NAME, SITE_NAME } from "@/lib/site";

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);

  if (!project) {
    return { title: "Project not found", robots: { index: false, follow: false } };
  }

  return {
    title: `${project.title} — Project`,
    description: project.summary,
    alternates: { canonical: `/projects/${project.slug}` },
    openGraph: {
      type: "article",
      title: `${project.title} — Project`,
      description: project.summary,
      url: `/projects/${project.slug}`,
    },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <article className="py-10 sm:py-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          name: project.title,
          description: project.summary,
          author: { "@type": "Person", name: AUTHOR_NAME },
          isPartOf: { "@type": "WebSite", name: SITE_NAME },
        }}
      />

      <header className="border-b border-fg pb-10">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 font-mono text-[12px] text-muted">
            <li>
              <Link href="/projects" className="inline-flex min-h-11 items-center hover:text-accent">
                Projects
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page">{project.title}</li>
          </ol>
        </nav>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="pill pill-accent">{project.status}</span>
          <span className="ver text-muted">{project.role}</span>
        </div>
        <h1 className="font-display mt-5 max-w-[22ch] text-balance text-[32px] font-semibold leading-[1.15] tracking-[-0.035em] sm:text-[44px]">
          {project.title}
        </h1>
        <p className="mt-5 max-w-[66ch] text-[18px] leading-8 text-muted">
          {project.summary}
        </p>
      </header>

      <div className="grid gap-12 py-12 lg:grid-cols-[minmax(0,42rem)_minmax(16rem,1fr)] lg:gap-16 lg:py-16">
        <div className="prose order-2 lg:order-1">
          <section aria-labelledby="project-problem">
            <h2 id="project-problem">Problem</h2>
            {project.problem.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>

          <section aria-labelledby="project-why">
            <h2 id="project-why">Why it exists</h2>
            {project.whyItExists.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>

          <section aria-labelledby="project-architecture">
            <h2 id="project-architecture">Architecture</h2>
            <p>
              The sequence keeps collection useful without letting automation cross the
              editorial boundary.
            </p>
            <ol>
              {project.architecture.map((step) => (
                <li key={step.label}>
                  <strong>{step.label}.</strong> {step.detail}
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="project-decisions">
            <h2 id="project-decisions">Engineering decisions</h2>
            {project.decisions.map((decision) => {
              const id = `decision-${decision.title.replaceAll(" ", "-").toLowerCase()}`;
              return (
                <section key={decision.title} aria-labelledby={id}>
                  <h3 id={id}>{decision.title}</h3>
                  <p>{decision.detail}</p>
                </section>
              );
            })}
          </section>

          <section aria-labelledby="project-current-work">
            <h2 id="project-current-work">Current work</h2>
            <ul>
              {project.currentWork.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="order-1 h-fit space-y-7 border-y border-rule py-7 lg:order-2 lg:border-b-0 lg:border-l lg:border-t-0 lg:py-0 lg:pl-8">
          <section aria-labelledby="capabilities-heading">
            <h2 id="capabilities-heading" className="section-label">
              Repository-backed capabilities
            </h2>
            <ul className="mt-3 space-y-2 text-[14px] leading-6">
              {project.capabilities.map((capability) => (
                <li key={capability} className="border-b border-rule pb-2 last:border-b-0">
                  {capability}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="technology-heading">
            <h2 id="technology-heading" className="section-label">
              Technology
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {project.technologies.map((technology) => (
                <li key={technology} className="pill">
                  {technology}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="case-study-scope" className="rounded-md bg-surface-2 p-4">
            <h2 id="case-study-scope" className="section-label text-fg">
              Scope of this case study
            </h2>
            <p className="mt-2 text-[13.5px] leading-6 text-muted">
              This page describes product direction and code present in the Engineerious
              repository. It does not claim adoption, performance results, private client
              work, or experience that has not been published.
            </p>
          </section>
        </aside>
      </div>

      <footer className="border-t-2 border-fg pt-6">
        <Link
          href="/projects"
          className="inline-flex min-h-11 items-center font-mono text-[13px] font-medium text-accent hover:underline"
        >
          <span aria-hidden>←&nbsp;</span> All projects
        </Link>
      </footer>
    </article>
  );
}
