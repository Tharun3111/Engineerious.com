import Link from "next/link";

import { AuthorBadge } from "@/components/AuthorBadge";
import { SocialLinks } from "@/components/SocialLinks";
import { env } from "@/lib/env";
import { AUTHOR_NAME, SITE_NAME } from "@/lib/site";

const EXPLORE = [
  { href: "/daily", label: "Daily" },
  { href: "/blog", label: "Writing" },
  { href: "/ai", label: "AI" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
] as const;

const LEGAL = [
  { href: "/editorial-standards", label: "Editorial standards" },
  { href: "/corrections", label: "Corrections" },
  { href: "/ethics", label: "Ethics" },
] as const;

export function Footer() {
  return (
    <footer className="mt-20 border-t border-fg bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_1fr_1fr] lg:px-8">
        <div className="max-w-md">
          <Link href="/" aria-label="Engineerious home" className="inline-flex items-center gap-3">
            <AuthorBadge size="lg" />
            <span className="leading-tight">
              <span className="font-display block text-[14px] font-semibold tracking-[-0.03em] text-fg">
                {SITE_NAME}
              </span>
              <span className="font-mono block text-[10px] uppercase tracking-[0.06em] text-muted">
                {AUTHOR_NAME}
              </span>
            </span>
          </Link>
          <p className="mt-4 text-[14.5px] leading-6 text-muted">
            An AI engineering desk for field notes, reviewed signal, and the production details that matter after the demo.
          </p>
          <div className="mt-3">
            <SocialLinks />
          </div>
        </div>

        <nav aria-label="Explore Engineerious">
          <p className="section-label">Explore</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 md:grid-cols-1">
            {EXPLORE.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="inline-flex min-h-11 items-center text-[13.5px] text-muted hover:text-accent">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Editorial policies">
          <p className="section-label">Standards</p>
          <ul className="mt-2">
            {LEGAL.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="inline-flex min-h-11 items-center text-[13.5px] text-muted hover:text-accent">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/rss.xml" className="inline-flex min-h-11 items-center text-[13.5px] text-muted hover:text-accent">
                RSS feed
              </Link>
            </li>
            {env.contactEmail && (
              <li>
                <a href={`mailto:${env.contactEmail}`} className="inline-flex min-h-11 items-center text-[13.5px] text-muted hover:text-accent">
                  Email Tharun
                </a>
              </li>
            )}
          </ul>
        </nav>
      </div>

      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 font-mono text-[10.5px] text-muted sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} {AUTHOR_NAME}</span>
          <span>{SITE_NAME} / AI engineering field notebook</span>
        </div>
      </div>
    </footer>
  );
}
