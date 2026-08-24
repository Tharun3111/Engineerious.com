import type { Metadata } from "next";

import "@fontsource-variable/instrument-sans/wght.css";
import "@fontsource-variable/martian-mono/wght.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";

import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { Nav } from "@/components/Nav";
import { env } from "@/lib/env";
import { AUTHOR_NAME, SITE_NAME } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: "Engineerious — Tharun Chowdary teaches AI engineering",
    template: "%s · Engineerious",
  },
  description:
    "What I've learned building AI systems that work past the demo — evaluation, MCP, retrieval, and the production details a clean demo leaves out. Written by Tharun Chowdary.",
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": "/rss.xml" },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: env.siteUrl,
  },
  twitter: {
    card: "summary_large_image",
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

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: AUTHOR_NAME,
  url: env.siteUrl,
  sameAs: [env.linkedinUrl, env.githubUrl, env.twitterUrl].filter((url): url is string => Boolean(url)),
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: env.siteUrl,
  logo: `${env.siteUrl}/icon.svg`,
  founder: { "@type": "Person", name: AUTHOR_NAME },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: env.siteUrl,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <JsonLd data={personJsonLd} />
        <JsonLd data={organizationJsonLd} />
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
      </body>
    </html>
  );
}
