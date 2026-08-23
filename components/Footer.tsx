import Link from "next/link";

import { SocialLinks } from "@/components/SocialLinks";
import { env } from "@/lib/env";

const LEGAL = [
  { href: "/editorial-standards", label: "Editorial standards" },
  { href: "/corrections", label: "Corrections" },
  { href: "/ethics", label: "Ethics" },
] as const;

/**
 * Closes on a rule, not a slab.
 *
 * This was a near-black three-column block with a logo lockup, an Explore column
 * of six links and a Connect column — the second ink object on a paper site, and
 * a site map for a site with one section. On the prototype the page simply ends:
 * a hairline, a wordmark, and the line that states the standard.
 */
export function Footer() {
  return (
    <footer className="mt-20 border-t border-rule">
      <div className="mx-auto flex max-w-7xl flex-wrap items-baseline gap-x-8 gap-y-4 px-4 pb-14 pt-6 text-[12.5px] text-muted sm:px-6 lg:px-8">
        <span className="font-display text-[15px] text-fg">
          Engineerious <span className="italic text-muted">/ Reproduction Log</span>
        </span>

        <span className="hidden sm:inline">Every claim shows whether anyone checked it.</span>

        <nav aria-label="Site policies" className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
          {LEGAL.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-fg">
              {item.label}
            </Link>
          ))}
          {env.contactEmail && (
            <a href={`mailto:${env.contactEmail}`} className="hover:text-fg">
              Email
            </a>
          )}
          <SocialLinks />
        </nav>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-10 text-[11.5px] text-muted sm:px-6 lg:px-8">
        © {new Date().getFullYear()} Engineerious
      </div>
    </footer>
  );
}
