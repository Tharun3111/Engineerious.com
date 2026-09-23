import type { PublishedHandbookEntry } from "@/lib/handbook";
import { isoDate } from "@/lib/time";

const ORIGIN_LABELS: Record<PublishedHandbookEntry["origin"], string> = {
  human: "Human authored",
  ai_assisted: "AI-assisted, human owned",
};

/**
 * The handbook's signature element: a compact, visible proof record beside the
 * reference it governs. This is deliberately an aside rather than a row of vague
 * trust badges—the reader can inspect who reviewed the entry and every source.
 */
export function HandbookProvenance({ entry }: { entry: PublishedHandbookEntry }) {
  const modelFacts = entry.modelFacts;
  const optionalModelFacts = modelFacts
    ? [
        modelFacts.license !== undefined ? ["License", modelFacts.license] : null,
        modelFacts.contextWindow !== undefined
          ? ["Context", `${modelFacts.contextWindow.toLocaleString("en-US")} tokens`]
          : null,
        modelFacts.modalities !== undefined
          ? ["Modalities", modelFacts.modalities.join(", ")]
          : null,
        modelFacts.api !== undefined ? ["API", modelFacts.api ? "Yes" : "No"] : null,
        modelFacts.local !== undefined ? ["Local use", modelFacts.local ? "Yes" : "No"] : null,
        modelFacts.toolCalling !== undefined
          ? ["Tool calling", modelFacts.toolCalling ? "Yes" : "No"]
          : null,
        modelFacts.structuredOutput !== undefined
          ? ["Structured output", modelFacts.structuredOutput ? "Yes" : "No"]
          : null,
        modelFacts.reasoning !== undefined
          ? ["Reasoning mode", modelFacts.reasoning ? "Yes" : "No"]
          : null,
        modelFacts.fineTuning !== undefined
          ? ["Fine-tuning", modelFacts.fineTuning ? "Yes" : "No"]
          : null,
      ].filter((fact): fact is [string, string] => fact !== null)
    : [];

  return (
    <aside className="order-1 h-fit border-y border-rule py-6 lg:order-2 lg:sticky lg:top-24 lg:border-b-0 lg:border-l lg:border-t-0 lg:py-0 lg:pl-8">
      <section aria-labelledby="handbook-proof-record">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="handbook-proof-record" className="section-label text-fg">
            Proof record
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-positive">
            Reviewed
          </span>
        </div>

        <dl className="mt-4 divide-y divide-rule border-y border-rule">
          <div className="grid grid-cols-[6.4rem_minmax(0,1fr)] gap-3 py-3">
            <dt className="section-label">Origin</dt>
            <dd className="text-[13px] leading-5 text-fg">{ORIGIN_LABELS[entry.origin]}</dd>
          </div>
          <div className="grid grid-cols-[6.4rem_minmax(0,1fr)] gap-3 py-3">
            <dt className="section-label">Sources</dt>
            <dd className="text-[13px] capitalize leading-5 text-fg">{entry.sourceStatus}</dd>
          </div>
          <div className="grid grid-cols-[6.4rem_minmax(0,1fr)] gap-3 py-3">
            <dt className="section-label">Tested</dt>
            <dd className="text-[13px] capitalize leading-5 text-fg">
              {entry.testedStatus.replaceAll("_", " ")}
            </dd>
          </div>
          <div className="grid grid-cols-[6.4rem_minmax(0,1fr)] gap-3 py-3">
            <dt className="section-label">Authenticity</dt>
            <dd className="text-[13px] capitalize leading-5 text-fg">
              {entry.authenticityStatus}
            </dd>
          </div>
          <div className="grid grid-cols-[6.4rem_minmax(0,1fr)] gap-3 py-3">
            <dt className="section-label">Reviewed by</dt>
            <dd className="text-[13px] leading-5 text-fg">{entry.reviewedBy}</dd>
          </div>
          <div className="grid grid-cols-[6.4rem_minmax(0,1fr)] gap-3 py-3">
            <dt className="section-label">Reviewed</dt>
            <dd className="font-mono text-[11px] text-fg">
              <time dateTime={entry.reviewedAt.toISOString()}>{isoDate(entry.reviewedAt)}</time>
            </dd>
          </div>
          <div className="grid grid-cols-[6.4rem_minmax(0,1fr)] gap-3 py-3">
            <dt className="section-label">Updated</dt>
            <dd className="font-mono text-[11px] text-fg">
              <time dateTime={entry.updatedAt.toISOString()}>{isoDate(entry.updatedAt)}</time>
            </dd>
          </div>
        </dl>
      </section>

      {modelFacts ? (
        <section aria-labelledby="handbook-model-facts" className="mt-8">
          <h2 id="handbook-model-facts" className="section-label text-fg">
            Model facts
          </h2>
          <dl className="mt-3 divide-y divide-rule border-y border-rule">
            {[
              ["Lab", modelFacts.lab],
              ["Released", isoDate(modelFacts.releaseDate)],
              ["Access", modelFacts.accessStatus.replaceAll("_", " ")],
              ["Openness", modelFacts.openStatus.replaceAll("_", " ")],
              ...optionalModelFacts,
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[6.4rem_minmax(0,1fr)] gap-3 py-3">
                <dt className="section-label">{label}</dt>
                <dd className="text-[13px] capitalize leading-5 text-fg">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="handbook-source-ledger" className="mt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="handbook-source-ledger" className="section-label text-fg">
            Source ledger
          </h2>
          <span className="font-mono text-[10.5px] tabular-nums text-muted">
            {entry.sources.length}
          </span>
        </div>
        <ol className="mt-3 divide-y divide-rule border-y border-rule">
          {entry.sources.map((source, index) => (
            <li key={source.url} className="py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                Source {String(index + 1).padStart(2, "0")} · {source.publisher}
              </p>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex min-h-11 items-center text-[13.5px] font-semibold leading-5 text-accent hover:underline"
              >
                {source.label} <span aria-hidden="true">&nbsp;↗</span>
              </a>
              <p className="font-mono text-[10px] leading-5 text-muted">
                {source.publishedAt ? `Published ${isoDate(source.publishedAt)} · ` : ""}
                Accessed {isoDate(source.accessedAt)}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
