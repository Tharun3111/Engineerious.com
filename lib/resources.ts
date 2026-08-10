import type { PillarSlug } from "@/lib/pillars";

/**
 * Free Resources — link cards to guides/templates/tools, not hosted content. If a
 * resource needs its own long-form page later, that becomes a blog post instead;
 * this list stays link-cards only.
 *
 * PLACEHOLDER CONTENT: the entries below exist so the page and layout are real and
 * testable. Swap them for actual resources before launch — none of these files exist
 * yet.
 */
export type ResourceType = "guide" | "template" | "cheatsheet" | "tool" | "dataset";

export type Resource = {
  slug: string;
  title: string;
  description: string;
  type: ResourceType;
  pillar?: PillarSlug;
  /** External or internal link. Internal links can point at a not-yet-built path. */
  url: string;
  /** True while `url` has no real destination yet — renders as "Coming soon". */
  comingSoon?: boolean;
};

export const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  guide: "Guide",
  template: "Template",
  cheatsheet: "Cheatsheet",
  tool: "Tool",
  dataset: "Dataset",
};

export const RESOURCES: Resource[] = [
  {
    slug: "eval-metric-selection-checklist",
    title: "Eval Metric Selection Checklist",
    description:
      "The five-step procedure for testing whether a metric actually separates a good build from a regressed one, before it goes in your CI gate.",
    type: "cheatsheet",
    pillar: "eval-first",
    url: "/resources",
    comingSoon: true,
  },
  {
    slug: "mcp-server-starter",
    title: "MCP Server Starter (TypeScript)",
    description:
      "A minimal, production-shaped MCP server template: per-tool timeouts, a circuit breaker, and schema versioning wired in from the start.",
    type: "template",
    pillar: "mcp",
    url: "/resources",
    comingSoon: true,
  },
  {
    slug: "rag-index-health-queries",
    title: "RAG Index Health Queries",
    description:
      "The four SQL queries that diagnose most retrieval regressions — freshness, embedding-model drift, source-mix shift, and empty-filter rate.",
    type: "cheatsheet",
    pillar: "rag-mlops",
    url: "/resources",
    comingSoon: true,
  },
  {
    slug: "llm-as-judge-rubric-template",
    title: "LLM-as-Judge Rubric Template",
    description:
      "A per-claim decomposition rubric that holds up better than a 1–5 Likert score — the shape that survived the 45-metric teardown.",
    type: "template",
    pillar: "eval-first",
    url: "/resources",
    comingSoon: true,
  },
];

export function getResource(slug: string): Resource | undefined {
  return RESOURCES.find((r) => r.slug === slug);
}
