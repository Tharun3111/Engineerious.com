/** The three things Engineerious is actually about. Everything else is a feed. */
export const PILLARS = [
  {
    slug: "eval-first",
    name: "Eval-First AI Engineering",
    tagline: "Measure before you ship. Then measure what shipping changed.",
    description:
      "Evaluation is the only part of an LLM system that tells you whether the rest of it works. This pillar covers building offline eval sets from production traffic, choosing metrics that survive contact with real users, LLM-as-judge calibration, regression gates in CI, and the failure modes of every one of those.",
  },
  {
    slug: "mcp",
    name: "Open Standards & MCP Production Engineering",
    tagline: "Model Context Protocol past the demo server.",
    description:
      "MCP made tool integration a protocol instead of a per-vendor SDK. Running it in production is a different problem: transport choice, auth and scoping, server lifecycle, schema versioning, failure isolation when a tool call hangs, and what to do when the spec moves under you.",
  },
  {
    slug: "rag-mlops",
    name: "Production RAG & MLOps",
    tagline: "Retrieval is an infrastructure problem wearing an ML hat.",
    description:
      "Chunking and embedding choices are the easy half. The hard half is index freshness, hybrid retrieval tuning, evaluation of retrieval separately from generation, cost per query at scale, and the operational surface — deploys, rollbacks, monitoring, drift — around a system whose output is non-deterministic.",
  },
] as const;

export type Pillar = (typeof PILLARS)[number];
export type PillarSlug = Pillar["slug"];

export const PILLAR_SLUGS = PILLARS.map((p) => p.slug) as readonly PillarSlug[];

export function getPillar(slug: string): Pillar | undefined {
  return PILLARS.find((p) => p.slug === slug);
}

export function pillarName(slug: string): string {
  return getPillar(slug)?.name ?? slug;
}
