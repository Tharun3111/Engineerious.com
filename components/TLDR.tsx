export function TLDR({ text }: { text?: string }) {
  if (!text) return null;

  return (
    <div className="measure border-y border-rule py-3 text-[15.5px] leading-7">
      <span className="eyebrow mr-2">TL;DR</span>
      {text}
    </div>
  );
}
