import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Engineering Desk",
  description:
    "A reviewed map of Engineerious writing, concepts, tools, models, and open-source AI engineering work.",
  alternates: { canonical: "/ai" },
  robots: { index: false, follow: true },
};

const plannedLenses = [
  ["Retrieval", "RAG, embeddings, search, reranking, and evaluation."],
  ["Agents", "Tool use, orchestration, memory, MCP, and multi-agent systems."],
  ["Models", "Capabilities and trade-offs that matter in an engineering decision."],
  ["Infrastructure", "Inference, observability, deployment, and reliability."],
] as const;

/** Honest route foundation; Phase 3 replaces this with reviewed cross-content discovery. */
export default function AiFoundationPage() {
  return (
    <div className="mx-auto max-w-5xl py-10 sm:py-14">
      <header className="border-b border-fg pb-8">
        <p className="eyebrow">AI engineering desk</p>
        <h1 className="font-display mt-3 max-w-[25ch] text-balance text-[28px] font-semibold leading-[1.25] tracking-[-0.03em] sm:text-[38px]">
          A map of the systems behind modern AI applications.
        </h1>
        <p className="mt-4 max-w-[64ch] text-[16px] leading-7 text-muted">
          This section is being organized around engineering questions, not a directory
          of buzzwords. Reviewed writing is available now; topic hubs and curated signal
          will appear here only when they contain useful material.
        </p>
      </header>

      <section className="grid gap-px border border-rule bg-rule sm:grid-cols-2" aria-labelledby="ai-lenses">
        <h2 id="ai-lenses" className="sr-only">Engineering lenses</h2>
        {plannedLenses.map(([name, description]) => (
          <div key={name} className="bg-surface p-5 sm:p-6">
            <h3 className="font-display text-[15px] font-semibold">{name}</h3>
            <p className="mt-2 text-[14px] leading-6 text-muted">{description}</p>
          </div>
        ))}
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/blog" className="btn btn-primary">Browse reviewed writing</Link>
        <Link href="/editorial-standards" className="btn btn-secondary">How review works</Link>
      </div>
    </div>
  );
}
