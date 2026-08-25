export type ProjectArchitectureStep = {
  readonly label: string;
  readonly detail: string;
};

export type ProjectDecision = {
  readonly title: string;
  readonly detail: string;
};

export type Project = {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly status: "In development" | "Published";
  readonly role: string;
  readonly featured: boolean;
  readonly problem: readonly string[];
  readonly whyItExists: readonly string[];
  readonly architecture: readonly ProjectArchitectureStep[];
  readonly decisions: readonly ProjectDecision[];
  readonly capabilities: readonly string[];
  readonly technologies: readonly string[];
  readonly currentWork: readonly string[];
};

const engineerious = {
  slug: "engineerious",
  title: "Engineerious",
  summary:
    "A text-first AI engineering desk that combines reviewed intelligence, technical writing, and a human-controlled research pipeline.",
  status: "In development",
  role: "Personal AI engineering project",
  featured: true,
  problem: [
    "Important AI developments arrive through lab announcements, research papers, repositories, engineering blogs, and media. A fast feed can report what changed without helping an engineer decide what deserves attention.",
    "The product therefore has two jobs: preserve useful collection and ranking infrastructure, then add the context, technical significance, and human judgment that a generic aggregator cannot provide.",
  ],
  whyItExists: [
    "Tharun is building Engineerious as his personal AI engineering desk: one place for practical writing, reviewed AI intelligence, project notes, and the questions he is working through.",
    "The editorial goal is straightforward. A useful entry should explain what happened, why it matters, what changed technically, and what an engineer should learn from it. Volume is not the measure of success.",
  ],
  architecture: [
    {
      label: "Collect",
      detail:
        "Source adapters gather candidate news, model, open-source, and research material from public feeds and APIs.",
    },
    {
      label: "Normalize and rank",
      detail:
        "Candidates share one item model, deduplicate by canonical URL hash, and use a Hacker News-style score with source authority and freshness.",
    },
    {
      label: "Research and draft",
      detail:
        "The daily workflow turns gathered material into source-linked findings and an unpublished database-backed draft.",
    },
    {
      label: "Review",
      detail:
        "Grounding and voice checks surface problems for the reviewer. AI-generated work remains a pending draft until a named human approves it.",
    },
    {
      label: "Publish",
      detail:
        "Verified MDX writing and manually approved database-native work become public; collection never implies publication.",
    },
  ],
  decisions: [
    {
      title: "Separate collection from publication",
      detail:
        "Ingestion can continue behind the scenes while unfinished or unreviewed feed surfaces remain closed to the public.",
    },
    {
      title: "Use two deliberate content sources",
      detail:
        "Human-authored writing stays in typed MDX. Runtime daily drafts use Postgres because a deployed server process cannot write durable files back into the repository.",
    },
    {
      title: "Make provenance part of the data",
      detail:
        "Published writing tracks origin, source status, testing status, authenticity, reviewer, and review time instead of treating trust as presentation copy.",
    },
    {
      title: "Fail closed at editorial boundaries",
      detail:
        "Generated source URLs are checked against gathered material, protected routes require credentials, and AI-generated drafts cannot mark themselves verified.",
    },
  ],
  capabilities: [
    "Typed MDX publishing",
    "Source adapters and deduplication",
    "Hacker News-style ranking",
    "Review-first daily drafting",
    "Authenticated editorial queue",
    "Manual publication controls",
    "Newsletter signup capture",
    "Automated unit and browser checks",
  ],
  technologies: [
    "Next.js 16",
    "React 19",
    "TypeScript",
    "Tailwind CSS 4",
    "Drizzle ORM",
    "Neon Postgres",
    "MDX",
    "Vercel Cron",
    "Vitest",
    "Playwright",
  ],
  currentWork: [
    "Strengthening the personal publishing surface around Tharun's writing, projects, and engineering point of view.",
    "Turning the daily research workflow into a concise, reviewable intelligence experience instead of another long automated post.",
    "Opening curated topic and handbook surfaces only when they contain reviewed material worth publishing.",
  ],
} as const satisfies Project;

/**
 * Projects are an editorial collection, not sample portfolio data. Add an entry
 * only when its ownership, status, and claims can be supported by this repository
 * or by material Tharun has supplied directly.
 */
export const projects = [engineerious] as const satisfies readonly Project[];

export const featuredProjects: readonly Project[] = projects.filter(
  (project) => project.featured,
);

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}
