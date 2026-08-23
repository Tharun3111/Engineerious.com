"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/Logo";

const LINKS = [
  { href: "/blog", label: "Blog" },
  { href: "/archive", label: "Archive" },
  { href: "/about", label: "About" },
] as const;

/** "/blog" is current on /blog/some-post too, but "/" must not match everything. */
function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname() ?? "";

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-fg/[0.98] text-white backdrop-blur">
      <nav aria-label="Primary" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-18 items-center gap-6 py-2.5">
          <Link
            href="/"
            className="shrink-0 focus-visible:outline-white"
            aria-label="Engineerious home"
          >
            <Logo priority className="h-auto w-[148px] sm:w-[184px]" />
          </Link>

          <span className="hidden border-l border-white/15 pl-5 font-mono text-[10px] uppercase leading-4 tracking-[0.14em] text-white/45 lg:block">
            Independent AI
            <br />
            engineering desk
          </span>

          <ul className="ml-auto hidden items-center gap-1 md:flex">
            {LINKS.map((link) => {
              const current = isCurrent(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={`flex min-h-11 items-center border-b-2 px-3 text-[15px] font-medium transition-colors duration-150 focus-visible:outline-white ${
                      current
                        ? "border-white text-white"
                        : "border-transparent text-white/75 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* White on the ink bar. The CTA was a saturated green before, which
           * belonged to no palette this site has ever had. Red is unavailable by
           * rule — it means "unpatched" and nothing else — so white is the only
           * fill that reads as the one primary action. */}
          <Link
            href="/subscribe"
            className="ml-auto inline-flex min-h-11 items-center justify-center bg-white px-4 text-[14px] font-semibold text-fg transition-colors duration-150 hover:bg-accent-tint focus-visible:outline-white md:ml-2"
          >
            Subscribe
          </Link>
        </div>

        <ul className="flex border-t border-white/15 md:hidden">
          {LINKS.map((link) => {
            const current = isCurrent(pathname, link.href);
            return (
              <li key={link.href} className="flex-1">
                <Link
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={`flex min-h-11 items-center justify-center border-b-2 px-2 text-[14px] font-medium focus-visible:outline-white ${
                    current ? "border-white text-white" : "border-transparent text-white/75 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
