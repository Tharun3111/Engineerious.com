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
    <div className="max-w-2xl space-y-8 py-8">
      <header className="space-y-2">
        <p className="eyebrow">Newsletter</p>
        <h1 className="text-[28px] font-bold tracking-tight leading-tight">
          The Engineerious newsletter
        </h1>
        <p className="text-[15px] text-muted">
          Notes on evaluation, agents, retrieval, models, and reliable AI systems —
          sent when I have verified work worth sharing.
        </p>
      </header>

      <NewsletterCTA
        heading="Subscribe"
        blurb="No fixed-volume promise, no automated link dump, and no invented certainty. Unsubscribe in one click."
      />

      <section className="card space-y-2.5 p-5 text-[14px] text-muted">
        <p>
          <strong className="text-fg">What you get:</strong> verified field notes,
          practical explanations, and the evidence or limitations behind each useful
          conclusion.
        </p>
        <p>
          <strong className="text-fg">What you do not get:</strong> daily sends, engagement
          bait, or your email address in anyone else&rsquo;s list.
        </p>
      </section>

      {/*
        Fallback embed. If BEEHIIV_API_KEY is unset, the form above returns a clear
        error and this iframe is the working path — so /subscribe is never a dead end.
      */}
      {env.beehiivEmbedUrl && (
        <section className="border-t border-rule pt-5">
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
