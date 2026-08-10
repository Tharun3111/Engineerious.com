import Link from "next/link";

import { Logo } from "@/components/Logo";
import { SocialLinks } from "@/components/SocialLinks";

const LINKS = [{ href: "/about", label: "About" }];

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-bg/85 backdrop-blur-md">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8"
      >
        <Link href="/" className="shrink-0" aria-label="Engineerious home">
          <Logo />
        </Link>

        <ul className="hidden flex-1 items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-full px-3 py-1.5 text-[14px] font-medium text-muted transition hover:bg-surface-2 hover:text-fg"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
          <SocialLinks className="hidden sm:flex" />
          <Link href="/subscribe" className="btn btn-primary btn-sm">
            Subscribe
          </Link>
        </div>
      </nav>

      <div className="border-t border-rule px-4 py-1.5 md:hidden">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:text-fg">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
