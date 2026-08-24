import Link from "next/link";

import { SocialLinks } from "@/components/SocialLinks";
import { env } from "@/lib/env";

const LEGAL = [
  { href: "/editorial-standards", label: "Editorial standards" },
  { href: "/corrections", label: "Corrections" },
  { href: "/ethics", label: "Ethics" },
] as const;

/**
 * Closes on a rule, not a slab. The wordmark previously read "Engineerious /
 * Reproduction Log" here too — same framing cleanup as Nav.tsx. Social links
 * (SocialLinks already renders Twitter/LinkedIn/GitHub/Instagram whenever the
 * corresponding NEXT_PUBLIC_* env var is set — see lib/env.ts) sit last, where
 * a reader who's finished a post looks for "where do I follow this person."
 */
export function Footer() {
  return (
    <footer className="mt-20 border-t border-rule">
      <div className="mx-auto flex max-w-7xl flex-wrap items-baseline gap-x-8 gap-y-4 px-4 pb-14 pt-6 text-[12.5px] text-muted sm:px-6 lg:px-8">
        <span className="font-display text-[14px] text-fg">
          engineerious <span className="font-mono font-normal text-muted">/ tharun chowdary</span>
        </span>

        <span className="hidden font-mono text-[11px] sm:inline">I write down what I learn, so you don&rsquo;t have to learn it twice.</span>

        <nav aria-label="Site policies" className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
          {LEGAL.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-accent">
              {item.label}
            </Link>
          ))}
          {env.contactEmail && (
            <a href={`mailto:${env.contactEmail}`} className="hover:text-accent">
              Email
            </a>
          )}
          <SocialLinks />
        </nav>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-10 font-mono text-[11px] text-muted sm:px-6 lg:px-8">
        © {new Date().getFullYear()} Engineerious
      </div>
    </footer>
  );
}
