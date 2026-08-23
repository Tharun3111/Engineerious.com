import Link from "next/link";

import { Logo } from "@/components/Logo";
import { SocialLinks } from "@/components/SocialLinks";
import { env } from "@/lib/env";

export function Footer() {
  return (
    <footer className="mt-24 bg-fg text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div>
          <Link href="/" aria-label="Engineerious home" className="inline-block">
            <Logo className="h-auto w-[200px]" />
          </Link>
          <p className="mt-4 max-w-sm text-[15px] leading-6 text-white/65">
            Source-checked AI news, model analysis, and production guides for engineers
            and technical founders.
          </p>
        </div>

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45">
            Explore
          </p>
          <ul className="mt-3 space-y-1 text-[15px] text-white/70">
            <li><Link href="/news" className="inline-flex min-h-11 items-center hover:text-white">AI news</Link></li>
            <li><Link href="/models" className="inline-flex min-h-11 items-center hover:text-white">Models</Link></li>
            <li><Link href="/blog" className="inline-flex min-h-11 items-center hover:text-white">Blog</Link></li>
            <li><Link href="/archive" className="inline-flex min-h-11 items-center hover:text-white">Archive</Link></li>
            <li><Link href="/about" className="inline-flex min-h-11 items-center hover:text-white">About Tharun</Link></li>
            <li><Link href="/subscribe" className="inline-flex min-h-11 items-center hover:text-white">Newsletter</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45">
            Connect
          </p>
          <div className="mt-3">
            {env.contactEmail && (
              <a href={`mailto:${env.contactEmail}`} className="inline-flex min-h-11 items-center text-[15px] text-white/70 hover:text-white">
                Email Tharun
              </a>
            )}
            <SocialLinks className="mt-2 text-white" />
          </div>
        </div>
      </div>

      <div className="border-t border-white/15">
        {/* /45 measured 3.9:1 on the navy footer. /65 clears 4.5:1 and still
         *  reads as the quiet legal row under the main links at /70. */}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-[13px] text-white/65 sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Engineerious. Sources, limits, and corrections stay visible.</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/editorial-standards" className="inline-flex min-h-11 items-center hover:text-white/80">Editorial standards</Link>
            <Link href="/corrections" className="inline-flex min-h-11 items-center hover:text-white/80">Corrections</Link>
            <Link href="/ethics" className="inline-flex min-h-11 items-center hover:text-white/80">Ethics</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
