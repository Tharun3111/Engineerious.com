import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HandbookProvenance } from "@/components/HandbookProvenance";
import type { PublishedHandbookEntry } from "@/lib/handbook";

const mocks = vi.hoisted(() => ({
  getEntry: vi.fn(),
  getStaticParams: vi.fn(),
}));

vi.mock("@/lib/handbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/handbook")>();
  return {
    ...actual,
    getPublishedHandbookEntry: mocks.getEntry,
    getHandbookStaticParams: mocks.getStaticParams,
  };
});

import {
  default as HandbookEntryPage,
  dynamicParams,
  generateMetadata,
  generateStaticParams,
  handbookArticleJsonLd,
  handbookBreadcrumbJsonLd,
} from "@/app/ai/[kind]/[slug]/page";

function publishedEntry(): PublishedHandbookEntry {
  return {
    schemaVersion: 1,
    kind: "model",
    routeKind: "models",
    slug: "reviewed-model",
    title: "A reviewed model",
    summary: "A sourced model reference.",
    publishedAt: new Date("2026-08-20T10:00:00.000Z"),
    updatedAt: new Date("2026-08-21T10:00:00.000Z"),
    draft: false,
    origin: "ai_assisted",
    sourceStatus: "mixed",
    testedStatus: "not_tested",
    authenticityStatus: "verified",
    reviewedBy: "Human Reviewer",
    reviewedAt: new Date("2026-08-21T11:00:00.000Z"),
    myTake: "A signed personal judgment.",
    tags: ["model-reference"],
    topicSlugs: ["agents"],
    sources: [
      {
        label: "Model documentation",
        publisher: "Model Lab",
        url: "https://models.example.org/docs",
        accessedAt: new Date("2026-08-21T00:00:00.000Z"),
      },
    ],
    modelFacts: {
      lab: "Model Lab",
      releaseDate: new Date("2026-08-01T00:00:00.000Z"),
      accessStatus: "public",
      openStatus: "open_weights",
      api: true,
      local: false,
    },
    body: "## What it is\n\nDefinition.",
    readingMinutes: 4,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("handbook route contract", () => {
  it("prebuilds only public params and rejects unknown dynamic params", () => {
    mocks.getStaticParams.mockReturnValue([{ kind: "models", slug: "reviewed-model" }]);
    expect(dynamicParams).toBe(false);
    expect(generateStaticParams()).toEqual([{ kind: "models", slug: "reviewed-model" }]);
  });

  it("emits canonical article metadata only for a published entry", async () => {
    mocks.getEntry.mockReturnValue(publishedEntry());
    const metadata = await generateMetadata({
      params: Promise.resolve({ kind: "models", slug: "reviewed-model" }),
    });
    expect(metadata.alternates).toEqual({ canonical: "/ai/models/reviewed-model" });
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      url: "/ai/models/reviewed-model",
      modifiedTime: "2026-08-21T10:00:00.000Z",
    });

    mocks.getEntry.mockReturnValue(null);
    const missing = await generateMetadata({
      params: Promise.resolve({ kind: "models", slug: "private-model" }),
    });
    expect(missing.robots).toEqual({ index: false, follow: false });
  });

  it("404s unknown and private entries", async () => {
    mocks.getEntry.mockReturnValue(null);
    await expect(
      HandbookEntryPage({
        params: Promise.resolve({ kind: "concepts", slug: "private-entry" }),
      }),
    ).rejects.toThrow();
  });

  it("keeps the route RSC-first with no nested main landmark", () => {
    const source = readFileSync(
      "app/ai/[kind]/[slug]/page.tsx",
      "utf8",
    );
    expect(source).toContain("<MDXRemote");
    expect(source).toContain("<ShareActions");
    expect(source).not.toContain("<main");
    expect(source).not.toContain('"use client"');
  });
});

describe("handbook structured data and visible provenance", () => {
  it("binds Article and Breadcrumb JSON-LD to the canonical public resource", () => {
    const entry = publishedEntry();
    const article = handbookArticleJsonLd(entry);
    const breadcrumbs = handbookBreadcrumbJsonLd(entry);
    expect(article).toMatchObject({
      "@type": "Article",
      headline: entry.title,
      datePublished: "2026-08-20T10:00:00.000Z",
      dateModified: "2026-08-21T10:00:00.000Z",
      citation: ["https://models.example.org/docs"],
      reviewedBy: { "@type": "Person", name: "Human Reviewer" },
    });
    expect(article.mainEntityOfPage).toEqual({
      "@type": "WebPage",
      "@id": "https://engineerious.com/ai/models/reviewed-model",
    });
    expect(breadcrumbs.itemListElement.map((item) => item.position)).toEqual([1, 2, 3]);
  });

  it("shows review, source, and supplied model facts without inventing optional values", () => {
    const html = renderToStaticMarkup(
      createElement(HandbookProvenance, { entry: publishedEntry() }),
    );
    expect(html).toContain("AI-assisted, human owned");
    expect(html).toContain("Human Reviewer");
    expect(html).toContain("mixed");
    expect(html).toContain("not tested");
    expect(html).toContain("Model documentation");
    expect(html).toContain("open weights");
    expect(html).toContain("Local use");
    expect(html).toContain("No");
    expect(html).not.toContain("Context");
    expect(html).not.toContain("Fine-tuning");
  });
});
