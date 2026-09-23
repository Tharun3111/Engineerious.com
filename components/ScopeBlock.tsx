/**
 * The signature object of the redesign — see the ".scope" block comment in
 * app/globals.css for the reasoning. Renders nothing when an entry hasn't
 * declared its scope yet, rather than a hollow placeholder: an empty promise
 * is worse than no promise.
 */
export function ScopeBlock({
  teaches,
  notCovered,
}: {
  teaches: string[];
  notCovered: string[];
}) {
  if (teaches.length === 0 && notCovered.length === 0) return null;

  return (
    <section className="scope" aria-label="Entry scope">
      <div>
        <p className="scope-title">You&rsquo;ll be able to</p>
        {teaches.length > 0 ? (
          <ul>
            {teaches.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-muted">Not stated yet.</p>
        )}
      </div>
      <div>
        <p className="scope-title">This won&rsquo;t cover</p>
        {notCovered.length > 0 ? (
          <ul>
            {notCovered.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-muted">Nothing excluded.</p>
        )}
      </div>
    </section>
  );
}
