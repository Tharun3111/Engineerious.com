export function ShareExcerpt({ dek, url }: { dek: string; url: string }) {
  return (
    <div className="max-w-[68ch] border border-rule px-5 py-4">
      <p className="section-label">Share this</p>
      <p className="mt-2.5 text-[15px] leading-7 text-fg">{dek}</p>
      <p className="mt-2 font-mono text-[12.5px] text-accent-strong">{url}</p>
    </div>
  );
}
