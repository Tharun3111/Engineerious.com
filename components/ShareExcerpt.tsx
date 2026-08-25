import { ShareActions } from "@/components/ShareActions";

export function ShareExcerpt({ title, dek, url }: { title: string; dek: string; url: string }) {
  return (
    <section aria-labelledby="share-writing-title" className="max-w-[68ch] border border-rule px-5 py-4">
      <h2 id="share-writing-title" className="section-label">Share this</h2>
      <p className="mt-2.5 text-[15px] leading-7 text-fg">{dek}</p>
      <ShareActions title={title} text={dek} url={url} />
    </section>
  );
}
