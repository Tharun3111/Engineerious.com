export function StockStrip({ quotes }: { quotes?: { ticker: string; percentChange: number | null }[] }) {
  const withMoves = quotes?.filter((q) => q.percentChange !== null) ?? [];
  if (withMoves.length === 0) return null;

  return (
    <div className="max-w-[68ch] border border-rule px-5 py-4">
      <p className="section-label">Market context</p>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[13.5px]">
        {withMoves.map((q) => {
          const up = (q.percentChange ?? 0) >= 0;
          return (
            <li key={q.ticker} className={up ? "text-positive" : "text-negative"}>
              {q.ticker} {up ? "+" : ""}
              {q.percentChange!.toFixed(1)}%
            </li>
          );
        })}
      </ul>
    </div>
  );
}
