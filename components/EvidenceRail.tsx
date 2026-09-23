const signals = [
  {
    label: "Reported",
    detail: "Claims point back to sources.",
  },
  {
    label: "Tested",
    detail: "Only shown when Tharun ran it.",
  },
  {
    label: "Opinion",
    detail: "Personal judgment is clearly marked.",
  },
  {
    label: "Reviewed",
    detail: "Machine drafts never publish themselves.",
  },
] as const;

/**
 * Engineerious's recurring trust signature. It keeps provenance visible without
 * turning every page into a compliance checklist.
 */
export function EvidenceRail({ compact = false }: { compact?: boolean }) {
  return (
    <section className="evidence-rail" aria-label="Engineerious evidence standard">
      <div className="evidence-rail__intro">
        <p className="section-label">The evidence rail</p>
        {!compact && (
          <p>
            What is known, what was run, and what is judgment should never blur together.
          </p>
        )}
      </div>
      <dl className="evidence-rail__signals">
        {signals.map((signal) => (
          <div key={signal.label}>
            <dt>{signal.label}</dt>
            <dd>{signal.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
