export function KeyFacts({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="measure border border-rule bg-surface px-5 py-4">
      <p className="section-label">Key facts</p>
      <ul className="mt-2.5 space-y-2 text-[14.5px] leading-6">
        {items.map((fact, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
            {fact}
          </li>
        ))}
      </ul>
    </div>
  );
}
