import type { Metadata } from "next";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Subscribe",
  description:
    "Get source-checked AI engineering analysis from Tharun Chowdary.",
  alternates: { canonical: "/subscribe" },
};

export default function SubscribePage() {
  return (
    <div className="max-w-4xl py-14 sm:py-20">
      <header className="max-w-3xl border-b border-rule pb-10">
        <p className="eyebrow">Newsletter</p>
        <h1 className="font-display mt-3 text-balance text-[46px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[62px]">
          Get useful AI engineering analysis, not another link dump.
        </h1>
        <p className="mt-6 max-w-2xl text-[19px] leading-8 text-muted">
          Receive source-checked notes on evaluation, agents, retrieval, models, and
          production reliability. Sent only when there is useful work to share.
        </p>
      </header>

      <div className="py-12">
        <NewsletterCTA
          hideHeading
          blurb="No daily send, automated link dump, or invented certainty. Unsubscribe in one click."
        />
      </div>

      <section className="divide-y divide-rule border-y border-rule text-[16px] text-muted">
        <div className="grid gap-2 py-6 sm:grid-cols-[10rem_1fr]">
          <h2 className="font-semibold text-fg">What you get</h2>
          <p>Practical engineering guides, model analysis, and the evidence and limits behind every conclusion.</p>
        </div>
        <div className="grid gap-2 py-6 sm:grid-cols-[10rem_1fr]">
          <h2 className="font-semibold text-fg">What you don’t get</h2>
          <p>Daily sends, engagement bait, automated link dumps, or your email address in anyone else&rsquo;s list.</p>
        </div>
      </section>

      {/*
        Optional secondary embed. The form above is the real signup path (Resend);
        this only renders if NEXT_PUBLIC_BEEHIIV_EMBED_URL is set.
      */}
      {env.beehiivEmbedUrl && (
        <section className="mt-10 border-t border-rule pt-6">
          <h2 className="section-label mb-2">Or use the beehiiv form</h2>
          <iframe
            src={env.beehiivEmbedUrl}
            title="beehiiv subscribe form"
            className="h-[86px] w-full border-0"
            loading="lazy"
          />
        </section>
      )}
    </div>
  );
}
