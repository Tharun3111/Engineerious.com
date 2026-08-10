import Link from "next/link";

import { Logo } from "@/components/Logo";

const LINKS = [
  { href: "/#what-you-get", label: "What you’ll get" },
  { href: "/about", label: "About" },
] as const;

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/15 bg-[#111827] text-white">
      <nav
        aria-label="Primary"
        className="mx-auto flex min-h-18 max-w-7xl items-center gap-6 px-4 py-2.5 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="shrink-0 focus-visible:outline-white"
          aria-label="Engineerious home"
        >
          <Logo priority className="h-auto w-[148px] sm:w-[184px]" />
        </Link>

        <ul className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex min-h-11 items-center px-3 text-[15px] font-medium text-white/75 transition-colors duration-150 hover:text-white"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/subscribe"
          className="ml-auto inline-flex min-h-11 items-center justify-center border border-[#22c55e] bg-[#22c55e] px-4 text-[14px] font-semibold text-[#111827] transition-colors duration-150 hover:bg-white md:ml-2"
        >
          Get the next note
        </Link>
      </nav>
    </header>
  );
}
