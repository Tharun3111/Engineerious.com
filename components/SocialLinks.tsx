import { env } from "@/lib/env";

/**
 * Renders only the icons whose URL is configured — see NEXT_PUBLIC_TWITTER_URL etc.
 * in .env.example. Nothing here guesses a handle; an unset account stays absent
 * rather than linking a placeholder.
 */
type SocialLink = { name: string; url: string | undefined; icon: (props: { className?: string }) => React.JSX.Element };

export function SocialLinks({ className = "" }: { className?: string }) {
  const all: SocialLink[] = [
    { name: "X", url: env.twitterUrl, icon: XIcon },
    { name: "Instagram", url: env.instagramUrl, icon: InstagramIcon },
    { name: "LinkedIn", url: env.linkedinUrl, icon: LinkedInIcon },
  ];
  const links = all.filter(
    (link): link is SocialLink & { url: string } => typeof link.url === "string" && link.url.length > 0,
  );

  if (links.length === 0) return null;

  return (
    <ul className={`flex items-center gap-1 ${className}`}>
      {links.map(({ name, url, icon: Icon }) => (
        <li key={name}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Engineerious on ${name}`}
            /* Colour comes from the caller (the footer sets text-white), not from
             * a hardcoded text-muted: on the navy footer that resolved to
             * #566b78 at 3.1:1. opacity carries the resting/hover state so this
             * works on light and dark surfaces alike. */
            className="flex h-11 w-11 items-center justify-center rounded-full opacity-70 transition hover:bg-white/10 hover:opacity-100"
          >
            <Icon className="h-4 w-4" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2H21.5l-7.5 8.57L22.8 22h-6.91l-5.41-6.9L4.24 22H1l8.02-9.17L1.5 2h7.08l4.89 6.3L18.24 2Zm-1.21 18.17h1.71L7.06 3.75H5.22l11.81 16.42Z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3.5 9.75h3v10.75h-3V9.75Zm6.25 0h2.88v1.47h.04c.4-.76 1.38-1.56 2.85-1.56 3.04 0 3.6 2 3.6 4.6v6.24h-3v-5.53c0-1.32-.02-3.02-1.84-3.02-1.84 0-2.12 1.44-2.12 2.92v5.63h-3V9.75Z" />
    </svg>
  );
}
