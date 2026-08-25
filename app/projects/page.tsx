import type { Metadata } from "next";
import Link from "next/link";

import { featuredProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Selected AI engineering projects by Tharun Chowdary Malepati, documented through architecture, constraints, and decisions.",
  alternates: { canonical: "/projects" },
};

export default function ProjectsPage() {
  return (
    <div className="space-y-10 py-10 sm:py-14">
      <header className="border-b border-fg pb-8">
        <p className="eyebrow">Selected work</p>
        <h1 className="font-display mt-3 max-w-[23ch] text-balance text-[28px] font-semibold leading-[1.25] tracking-[-0.03em] sm:text-[36px]">
          Projects, explained through the engineering decisions.
        </h1>
        <p className="mt-4 max-w-[64ch] text-[15.5px] leading-7 text-muted">
          This is a deliberately small collection. A project appears only when its
          ownership, status, architecture, and claims can be supported &mdash; not because
          a portfolio grid needs another card.
        </p>
      </header>

      <section aria-labelledby="project-list-heading">
        <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
          <h2 id="project-list-heading" className="section-label">
            Published case studies
          </h2>
          <span className="ver text-muted">{featuredProjects.length}</span>
        </div>

        <ol className="divide-y divide-rule">
          {featuredProjects.map((project) => (
            <li key={project.slug}>
              <article className="grid gap-5 py-8 md:grid-cols-[minmax(0,1fr)_15rem] md:gap-10">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="pill pill-accent">{project.status}</span>
                    <span className="ver text-muted">{project.role}</span>
                  </div>
                  <h3 className="font-display mt-4 text-[23px] font-semibold leading-tight tracking-[-0.02em]">
                    <Link href={`/projects/${project.slug}`} className="hover:text-accent">
                      {project.title}
                    </Link>
                  </h3>
                  <p className="mt-3 max-w-[62ch] text-[15.5px] leading-7 text-muted">
                    {project.summary}
                  </p>
                  <Link
                    href={`/projects/${project.slug}`}
                    className="mt-5 inline-flex min-h-11 items-center font-mono text-[13px] font-medium text-accent hover:underline"
                    aria-label={`Read the ${project.title} case study`}
                  >
                    Read the case study <span aria-hidden>&nbsp;→</span>
                  </Link>
                </div>

                <div className="border-l border-rule pl-5">
                  <p className="section-label">Built with</p>
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label={`${project.title} technologies`}>
                    {project.technologies.slice(0, 5).map((technology) => (
                      <li key={technology} className="pill">
                        {technology}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </li>
          ))}
        </ol>
      </section>

      <aside className="border-t-2 border-fg pt-6" aria-labelledby="project-note-heading">
        <h2 id="project-note-heading" className="section-label">
          Evidence note
        </h2>
        <p className="mt-3 max-w-[66ch] text-[14.5px] leading-6 text-muted">
          Example names from the product brief are not treated as completed work. Public
          links, screenshots, metrics, and lessons appear only when there is evidence to
          support them.
        </p>
      </aside>
    </div>
  );
}
