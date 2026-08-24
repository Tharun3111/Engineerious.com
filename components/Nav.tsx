"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AuthorBadge } from "@/components/AuthorBadge";
import { CommandPalette } from "@/components/CommandPalette";

const LINKS = [
  { href: "/blog", label: "Entries" },
  { href: "/archive", label: "Archive" },
  { href: "/about", label: "About" },
] as const;

/** "/blog" is current on /blog/some-post too, but "/" must not match everything. */
function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The masthead. Wordmark in the display face (Martian Mono), Tharun's monogram
 * and name beside it — the site's job is his brand, and before this redesign
 * his name never rendered anywhere on the page, only in metadata. The old
 * tagline here ("Agent containment failures / Tracked by one engineer") named
 * a framing this site no longer has; replaced with the command palette, which
 * does real work instead of describing the site.
 */
export function Nav() {
  const pathname = usePathname() ?? "";

  return (
    <header className="border-b border-rule bg-surface">
      <nav aria-label="Primary" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Engineerious home">
            <AuthorBadge />
            <span className="leading-tight">
              <span className="font-display block text-[15px] font-semibold tracking-[-0.03em] text-fg">
                engineerious
              </span>
              <span className="font-mono block text-[10.5px] text-muted">/ tharun chowdary</span>
            </span>
          </Link>

          <ul className="flex items-baseline gap-x-5">
            {LINKS.map((link) => {
              const current = isCurrent(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={`font-mono inline-flex min-h-11 items-center text-[12px] transition-colors duration-150 ${
                      current ? "font-medium text-accent" : "text-muted hover:text-fg"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <CommandPalette />

          <Link
            href="/subscribe"
            className="btn btn-primary btn-sm shrink-0"
          >
            Subscribe
          </Link>
        </div>
      </nav>
    </header>
  );
}
