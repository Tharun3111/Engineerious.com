import type { Metadata } from "next";

import { NewsletterCTA } from "@/components/NewsletterCTA";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Subscribe",
  description:
    "Verified notes on practical AI engineering from Tharun Chowdary.",
  alternates: { canonical: "/subscribe" },
};

export default function SubscribePage() {
  return (
    <div className="max-w-4xl py-14 sm:py-20">
      <header className="max-w-3xl border-b border-rule pb-10">
        <p className="eyebrow">Newsletter</p>
        <h1 className="font-display mt-3 text-balance text-[46px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[62px]">
          Practical AI engineering, when there is something worth sharing.
        </h1>
        <p className="mt-6 max-w-2xl text-[19px] leading-8 text-muted">
          Notes on evaluation, agents, retrieval, models, and reliable AI systems —
          sent when I have verified work worth sharing.
        </p>
      </header>

      <div className="py-12">
        <NewsletterCTA
        heading="Get the next field note"
        blurb="No fixed-volume promise, no automated link dump, and no invented certainty. Unsubscribe in one click."
      />
      </div>

      <section className="divide-y divide-rule border-y border-rule text-[16px] text-muted">
        <div className="grid gap-2 py-6 sm:grid-cols-[10rem_1fr]">
          <h2 className="font-semibold text-fg">What you get</h2>
          <p>Verified field notes, practical explanations, and the evidence or limitations behind each useful conclusion.</p>
        </div>
        <div className="grid gap-2 py-6 sm:grid-cols-[10rem_1fr]">
          <h2 className="font-semibold text-fg">What you don’t get</h2>
          <p>Daily sends, engagement bait, automated link dumps, or your email address in anyone else&rsquo;s list.</p>
        </div>
      </section>

      {/*
        Fallback embed. If BEEHIIV_API_KEY is unset, the form above returns a clear
        error and this iframe is the working path — so /subscribe is never a dead end.
      */}
      {env.beehiivEmbedUrl && (
        <section className="mt-10 border-t border-rule pt-6">
          <h2 className="section-label mb-2">Or subscribe via beehiiv</h2>
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
