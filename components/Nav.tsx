"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthorBadge } from "@/components/AuthorBadge";
import { CommandPalette } from "@/components/CommandPalette";

const LINKS = [
  { href: "/daily", label: "Daily" },
  { href: "/blog", label: "Writing" },
  { href: "/ai", label: "AI" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
] as const;

/** "/blog" is current on /blog/some-post too, but "/" must not match everything. */
function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const linkClass = (href: string, mobile = false) => {
    const current = isCurrent(pathname, href);
    return {
      current,
      className: `font-mono inline-flex min-h-11 items-center text-[12px] transition-colors duration-150 ${
        mobile ? "w-full border-b border-rule px-1" : "border-b-2 border-transparent"
      } ${
        current
          ? mobile
            ? "font-medium text-accent"
            : "border-accent font-medium text-accent"
          : "text-muted hover:text-fg"
      }`,
    };
  };

  return (
    <header className="border-b border-rule bg-surface">
      <nav aria-label="Primary" className="mx-auto max-w-7xl px-3 min-[360px]:px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 py-3 lg:gap-4">
          <Link
            href="/"
            className="flex min-w-0 shrink items-center gap-2 min-[360px]:gap-2.5"
            aria-label="Engineerious home"
            onClick={() => setMenuOpen(false)}
          >
            <AuthorBadge />
            <span className="min-w-0 leading-tight">
              <span className="font-display block whitespace-nowrap text-[12px] font-semibold tracking-[-0.035em] text-fg sm:text-[13px]">
                <span className="min-[360px]:hidden">Tharun M.</span>
                <span className="hidden min-[360px]:inline sm:hidden">Tharun C. Malepati</span>
                <span className="hidden sm:inline">Tharun Chowdary Malepati</span>
              </span>
              <span className="font-mono block whitespace-nowrap text-[8.5px] uppercase tracking-[0.07em] text-muted sm:text-[9px]">
                <span className="min-[360px]:hidden">AI engineering desk</span>
                <span className="hidden min-[360px]:inline">engineerious / AI engineering desk</span>
              </span>
            </span>
          </Link>

          <ul className="ml-5 hidden items-center gap-x-4 lg:flex xl:ml-8 xl:gap-x-5">
            {LINKS.map((link) => {
              const { current, className } = linkClass(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={className}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="ml-auto hidden items-center gap-2 lg:flex [&>button]:!ml-0">
            <CommandPalette />
            <Link href="/subscribe" className="btn btn-primary btn-sm shrink-0">
              Subscribe
            </Link>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 lg:hidden">
            <div className="[&>button]:!ml-0 [&>button]:!min-h-11 [&>button]:!min-w-11 [&>button]:!justify-center [&>button]:!px-0">
              <CommandPalette />
            </div>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-rule-strong bg-surface text-fg"
              aria-expanded={menuOpen}
              aria-controls="mobile-primary-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div id="mobile-primary-menu" className="border-t border-rule pb-4 lg:hidden">
            <ul className="grid sm:grid-cols-2 sm:gap-x-6">
              {LINKS.map((link) => {
                const { current, className } = linkClass(link.href, true);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={current ? "page" : undefined}
                      className={className}
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link
              href="/subscribe"
              className="btn btn-primary mt-4 w-full sm:w-auto"
              onClick={() => setMenuOpen(false)}
            >
              Subscribe
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
    </svg>
  );
}
