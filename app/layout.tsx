import type { Metadata } from "next";

import "@fontsource-variable/instrument-sans/wght.css";
import "@fontsource-variable/martian-mono/wght.css";

import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { Nav } from "@/components/Nav";
import { PrivacyAnalytics } from "@/components/PrivacyAnalytics";
import { env } from "@/lib/env";
import { AUTHOR_NAME, SITE_NAME } from "@/lib/site";
import "./globals.css";

const SITE_DESCRIPTION =
  "Tharun Chowdary Malepati's AI engineering desk: field notes and reviewed signal on LLMs, agents, retrieval, evaluation, and production AI systems.";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  applicationName: SITE_NAME,
  title: {
    default: "Engineerious — AI engineering by Tharun Chowdary Malepati",
    template: "%s · Engineerious",
  },
  description: SITE_DESCRIPTION,
  authors: [{ name: AUTHOR_NAME, url: "/about" }],
  creator: AUTHOR_NAME,
  publisher: SITE_NAME,
  category: "AI engineering",
  alternates: {
    types: { "application/rss+xml": "/rss.xml" },
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icon.svg"],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: SITE_NAME,
    title: "Engineerious — AI engineering by Tharun Chowdary Malepati",
    description: SITE_DESCRIPTION,
    url: env.siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Engineerious — AI engineering by Tharun Chowdary Malepati",
    description: SITE_DESCRIPTION,
  },
  // Undefined fields render no tag at all — see lib/env.ts. Google Search Console
  // and Bing Webmaster Tools each hand you a token during "add property"; paste it
  // as GOOGLE_SITE_VERIFICATION / BING_SITE_VERIFICATION in Vercel and redeploy
  // (these bake into the static homepage at build time, so an env-var-only change
  // needs a redeploy to take effect).
  verification: {
    google: env.googleSiteVerification,
    other: env.bingSiteVerification ? { "msvalidate.01": env.bingSiteVerification } : undefined,
  },
  robots: { index: true, follow: true },
};

const site = env.siteUrl.replace(/\/$/, "");
const personId = `${site}/#tharun`;

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": personId,
  name: AUTHOR_NAME,
  jobTitle: "AI / Machine Learning Engineer",
  description: SITE_DESCRIPTION,
  url: `${site}/about`,
  sameAs: [env.linkedinUrl, env.githubUrl, env.twitterUrl, env.instagramUrl].filter(
    (url): url is string => Boolean(url),
  ),
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${site}/#website`,
  name: SITE_NAME,
  url: site,
  description: SITE_DESCRIPTION,
  author: { "@id": personId },
  publisher: { "@id": personId },
  inLanguage: "en-US",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <JsonLd data={personJsonLd} />
        <JsonLd data={websiteJsonLd} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded-md focus:bg-accent focus:px-3 focus:py-1.5 focus:text-accent-fg"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {children}
        </main>
        <Footer />
        {process.env.VERCEL === "1" ? <PrivacyAnalytics /> : null}
      </body>
    </html>
  );
}
