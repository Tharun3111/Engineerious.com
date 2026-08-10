import Link from "next/link";

import { Logo } from "@/components/Logo";
import { SocialLinks } from "@/components/SocialLinks";
import { env } from "@/lib/env";

export function Footer() {
  return (
    <footer className="mt-24 bg-[#111827] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div>
          <Link href="/" aria-label="Engineerious home" className="inline-block">
            <Logo className="h-auto w-[200px]" />
          </Link>
          <p className="mt-4 max-w-sm text-[15px] leading-6 text-white/65">
            Practical notes for engineers and technical founders building AI systems
            that need to work beyond the demo.
          </p>
        </div>

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45">
            Explore
          </p>
          <ul className="mt-3 space-y-1 text-[15px] text-white/70">
            <li><Link href="/#what-you-get" className="inline-flex min-h-11 items-center hover:text-white">What you’ll get</Link></li>
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
        <div className="mx-auto max-w-7xl px-4 py-5 text-[13px] text-white/45 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Engineerious. Sources, limits, and corrections stay visible.
        </div>
      </div>
    </footer>
  );
}
