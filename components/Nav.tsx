"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/blog", label: "The log" },
  { href: "/archive", label: "Archive" },
  { href: "/about", label: "About" },
] as const;

/** "/blog" is current on /blog/some-post too, but "/" must not match everything. */
function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * A masthead, not a nav bar.
 *
 * This was a black sticky bar carrying the logo lockup, a mono tagline, five links
 * and a filled CTA — a SaaS header, and the most template-looking object on the
 * site. It also fought the page: an ink slab sitting above content that has no
 * other dark element anywhere.
 *
 * Now the wordmark is set in the display serif on the same paper as everything
 * else, closed by a 2px ink rule. The chrome and the content are made of the same
 * material, which is the whole point of the concept.
 */
export function Nav() {
  const pathname = usePathname() ?? "";

  return (
    <header className="border-b-2 border-fg bg-bg">
      <nav aria-label="Primary" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-baseline gap-x-7 gap-y-3 py-5">
          <Link href="/" className="shrink-0" aria-label="Engineerious home">
            <span className="font-display text-[21px] font-semibold tracking-[-0.025em] text-fg sm:text-[26px] lg:text-[28px]">
              Engineerious{" "}
              <span className="font-normal italic text-muted">/ Reproduction Log</span>
            </span>
          </Link>

          <ul className="flex items-baseline gap-x-6">
            {LINKS.map((link) => {
              const current = isCurrent(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center text-[13.5px] transition-colors duration-150 ${
                      current
                        ? "font-semibold text-fg underline decoration-1 underline-offset-[6px]"
                        : "text-muted hover:text-fg"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="ml-auto hidden text-right font-sans text-[10.5px] uppercase leading-[1.5] tracking-[0.13em] text-muted lg:block">
            Agent containment failures
            <br />
            Tracked by one engineer
          </p>

          <Link
            href="/subscribe"
            className="inline-flex min-h-11 items-center text-[13.5px] font-semibold text-fg underline decoration-1 underline-offset-[6px] hover:decoration-2"
          >
            Subscribe
          </Link>
        </div>
      </nav>
    </header>
  );
}
