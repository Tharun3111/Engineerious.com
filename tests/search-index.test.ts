import { describe, expect, it } from "vitest";

import { buildSearchIndex, type PublicSearchSources } from "@/lib/search-index";

function sources(): PublicSearchSources {
  return {
    writing: [
      {
        slug: "evals-that-hold-up",
        title: "Evals that hold up",
        description: "A reviewed field note.",
        label: "Eval-First AI Engineering",
        keywords: ["evals", " regression ", "EVALS"],
      },
    ],
    daily: [
      {
        date: "2026-08-25",
        title: "AI Daily Brief — August 25",
        description: "The reviewed changes worth knowing.",
        label: "August 25, 2026",
        keywords: ["models", "agents"],
      },
    ],
    signals: [
      {
        itemId: 42,
        title: "A curated release",
        description: "Why the release matters for engineers.",
        label: "OpenAI",
        keywords: ["models", "API"],
      },
    ],
    topics: [
      {
        slug: "rag",
        title: "RAG",
        description: "Retrieval engineering notes and signals.",
        label: "Topic hub",
        keywords: ["retrieval", "embeddings"],
      },
    ],
    projects: [
      {
        slug: "engineerious",
        title: "Engineerious",
        description: "A personal AI engineering desk.",
        label: "In development",
        keywords: ["Next.js", "Postgres"],
      },
    ],
    handbook: [
      {
        kind: "concept",
        routeKind: "concepts",
        slug: "hybrid-search",
        title: "Hybrid search",
        description: "A reviewed handbook explanation.",
        label: "Handbook concept",
        keywords: ["retrieval", "ranking"],
      },
      {
        kind: "framework",
        routeKind: "frameworks",
        slug: "langgraph",
        title: "LangGraph",
        description: "A reviewed framework decision guide.",
        label: "Framework guide",
        keywords: ["agents", "orchestration"],
      },
      {
        kind: "model",
        routeKind: "models",
        slug: "example-model",
        title: "Example Model",
        description: "A dated, source-linked model note.",
        label: "Model note",
        keywords: ["reasoning"],
      },
    ],
  };
}

describe("public search index", () => {
  it("normalizes every public content kind with its canonical public href", () => {
    expect(buildSearchIndex(sources())).toEqual([
      expect.objectContaining({
        id: "writing:evals-that-hold-up",
        kind: "writing",
        href: "/blog/evals-that-hold-up",
      }),
      expect.objectContaining({
        id: "daily:2026-08-25",
        kind: "daily",
        href: "/daily/2026-08-25",
      }),
      expect.objectContaining({
        id: "signal:42",
        kind: "signal",
        href: "/ai?signal=42#signal-42",
      }),
      expect.objectContaining({
        id: "topic:rag",
        kind: "topic",
        href: "/topics/rag",
      }),
      expect.objectContaining({
        id: "project:engineerious",
        kind: "project",
        href: "/projects/engineerious",
      }),
      expect.objectContaining({
        id: "concept:hybrid-search",
        kind: "concept",
        href: "/ai/concepts/hybrid-search",
      }),
      expect.objectContaining({
        id: "framework:langgraph",
        kind: "framework",
        href: "/ai/frameworks/langgraph",
      }),
      expect.objectContaining({
        id: "model:example-model",
        kind: "model",
        href: "/ai/models/example-model",
      }),
    ]);
  });

  it("deduplicates namespaced IDs without collapsing equal identities across kinds", () => {
    const input = sources();
    input.writing = [input.writing[0], input.writing[0]];
    input.topics = [
      ...input.topics,
      {
        slug: "evals-that-hold-up",
        title: "Evals",
        description: "An active topic.",
        label: "Topic hub",
        keywords: [],
      },
    ];

    const index = buildSearchIndex(input);
    expect(index.filter((entry) => entry.id === "writing:evals-that-hold-up")).toHaveLength(1);
    expect(index.some((entry) => entry.id === "topic:evals-that-hold-up")).toBe(true);
    expect(new Set(index.map((entry) => entry.id)).size).toBe(index.length);
  });

  it("keeps only normalized public fields and cleans keyword duplicates", () => {
    const [writing] = buildSearchIndex(sources());
    expect(writing).toEqual({
      id: "writing:evals-that-hold-up",
      kind: "writing",
      href: "/blog/evals-that-hold-up",
      title: "Evals that hold up",
      description: "A reviewed field note.",
      label: "Eval-First AI Engineering",
      keywords: ["evals", "regression"],
    });
    expect(Object.keys(writing).sort()).toEqual(
      ["id", "kind", "href", "title", "description", "label", "keywords"].sort(),
    );
  });
});
