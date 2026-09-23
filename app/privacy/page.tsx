import type { Metadata } from "next";

import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Engineerious handles page analytics, newsletter addresses, and sharing controls.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-[860px] py-10 sm:py-14">
      <header className="measure border-b border-fg pb-8">
        <p className="eyebrow">Site policy</p>
        <h1 className="font-display mt-3 text-balance text-[31px] font-semibold leading-[1.2] tracking-[-0.035em] sm:text-[42px]">
          Privacy, in plain language.
        </h1>
        <p className="mt-4 max-w-[64ch] text-[16px] leading-7 text-muted">
          Engineerious measures which public pages are useful and keeps the private editorial desk out of analytics. It does not run advertising or behavior-tracking profiles.
        </p>
        <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
          Effective <time dateTime="2026-08-25">August 25, 2026</time>
        </p>
      </header>

      <div className="measure divide-y divide-rule">
        <section aria-labelledby="privacy-analytics" className="py-7">
          <h2 id="privacy-analytics" className="font-display text-[20px] font-semibold">Page analytics</h2>
          <p className="mt-3 text-[15.5px] leading-7 text-muted">
            The site uses the base Vercel Web Analytics integration for aggregate pageview counts. Before a pageview leaves the browser, Engineerious removes the query string and URL fragment and drops every <code className="font-mono text-[13px] text-fg">/admin</code> visit.
          </p>
          <p className="mt-3 text-[15.5px] leading-7 text-muted">
            The integration accepts pageviews only. Engineerious sends no custom analytics events, search text, newsletter addresses, or account identifiers to analytics.
          </p>
        </section>

        <section aria-labelledby="privacy-consent" className="py-7">
          <h2 id="privacy-consent" className="font-display text-[20px] font-semibold">Consent and cookies</h2>
          <p className="mt-3 text-[15.5px] leading-7 text-muted">
            The current analytics setup is cookie-free, so there is no analytics consent banner. If Engineerious later adds advertising, session replay, nonessential cookies, or behavior-level tracking, this policy and the consent flow must change before those tools go live.
          </p>
        </section>

        <section aria-labelledby="privacy-newsletter" className="py-7">
          <h2 id="privacy-newsletter" className="font-display text-[20px] font-semibold">Newsletter</h2>
          <p className="mt-3 text-[15.5px] leading-7 text-muted">
            If you subscribe, Engineerious uses the email address you submit to manage and deliver the newsletter through its email service provider. It is not added to page analytics. Every delivered issue includes an unsubscribe route; unsubscribing stops future sends.
          </p>
        </section>

        <section aria-labelledby="privacy-sharing" className="py-7">
          <h2 id="privacy-sharing" className="font-display text-[20px] font-semibold">Sharing and outbound links</h2>
          <p className="mt-3 text-[15.5px] leading-7 text-muted">
            Share controls use your browser&rsquo;s native share sheet or copy a public permalink. Email, LinkedIn, and X receive the public title and URL only after you choose their link. Source links and other external sites apply their own privacy terms after you leave Engineerious.
          </p>
        </section>

        <section aria-labelledby="privacy-choices" className="py-7">
          <h2 id="privacy-choices" className="font-display text-[20px] font-semibold">Your choices</h2>
          <p className="mt-3 text-[15.5px] leading-7 text-muted">
            You can use the public site without an account, decline the newsletter, unsubscribe from an issue, or block analytics with your browser or content blocker.
            {env.contactEmail ? (
              <> For a privacy question, email <a className="text-accent underline underline-offset-2" href={`mailto:${env.contactEmail}`}>{env.contactEmail}</a>.</>
            ) : null}
          </p>
        </section>
      </div>
    </article>
  );
}
