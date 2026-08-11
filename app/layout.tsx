import type { Metadata } from "next";

import "@fontsource-variable/ibm-plex-sans/wght.css";
import "@fontsource-variable/newsreader/wght.css";

import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: "Engineerious — practical AI engineering for real systems",
    template: "%s · Engineerious",
  },
  description:
    "Practical notes for engineers and technical founders building reliable AI systems: models, agents, evaluation, retrieval, and production lessons.",
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
    siteName: "Engineerious",
    url: env.siteUrl,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
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
