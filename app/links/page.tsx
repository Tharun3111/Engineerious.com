import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/Logo";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Links",
  description: "Everything Engineerious, in one place.",
  alternates: { canonical: "/links" },
};

// "/news" used to be listed here too — it's closed (lib/public-launch.ts), so
// linking it from a link-in-bio page would send every visitor to a 404.
const LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: "Read the blog", href: "/blog" },
  { label: "Get the newsletter", href: "/subscribe" },
  ...(env.linkedinUrl ? [{ label: "LinkedIn", href: env.linkedinUrl, external: true }] : []),
  ...(env.instagramUrl ? [{ label: "Instagram", href: env.instagramUrl, external: true }] : []),
  ...(env.twitterUrl ? [{ label: "X / Twitter", href: env.twitterUrl, external: true }] : []),
  ...(env.contactEmail ? [{ label: "Email Tharun", href: `mailto:${env.contactEmail}`, external: true }] : []),
];

export default function LinksPage() {
  return (
    <div className="mx-auto flex min-h-[80svh] max-w-sm flex-col items-center py-16 text-center">
      <Link href="/" aria-label="Engineerious home">
        <Logo className="h-auto w-[180px]" />
      </Link>
      <p className="mt-4 text-[15px] text-muted">Tharun Chowdary — I teach AI engineering, one entry at a time.</p>

      <nav className="mt-8 flex w-full flex-col gap-3">
        {LINKS.map((link) =>
          link.external ? (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary w-full justify-center py-3 text-[15px]"
            >
              {link.label}
            </a>
          ) : (
            <Link
              key={link.label}
              href={link.href}
              className="btn btn-secondary w-full justify-center py-3 text-[15px]"
            >
              {link.label}
            </Link>
          ),
        )}
      </nav>
    </div>
  );
}
