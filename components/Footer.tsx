import Link from "next/link";

import { SocialLinks } from "@/components/SocialLinks";
import { env } from "@/lib/env";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-rule">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-accent-fg">
              E
            </span>
            <span className="text-[15px] font-bold tracking-tight">Engineerious</span>
          </Link>
          <p className="mt-3 max-w-xs text-[13.5px] text-muted">
            Practical AI engineering, learned in public by Tharun Chowdary.
          </p>
          <SocialLinks className="mt-4" />
        </div>

        <div>
          <p className="section-label">Engineerious</p>
          <ul className="mt-3 space-y-2 text-[13.5px] text-muted">
            <li><Link href="/about" className="hover:text-fg">About Tharun</Link></li>
            <li><Link href="/subscribe" className="hover:text-fg">Newsletter</Link></li>
          </ul>
        </div>

        <div>
          <p className="section-label">Connect</p>
          <ul className="mt-3 space-y-2 text-[13.5px] text-muted">
            {env.contactEmail && (
              <li>
                <a href={`mailto:${env.contactEmail}`} className="hover:text-fg">
                  {env.contactEmail}
                </a>
              </li>
            )}
            {env.linkedinUrl && (
              <li><a href={env.linkedinUrl} target="_blank" rel="noopener noreferrer" className="hover:text-fg">LinkedIn ↗</a></li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-4 py-5 sm:px-6 lg:px-8">
          <p className="font-mono text-[11.5px] text-muted">
            © {new Date().getFullYear()} Engineerious · Built around evidence, useful work, and clear disclosure.
          </p>
        </div>
      </div>
    </footer>
  );
}
