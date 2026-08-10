type LogoMarkProps = {
  className?: string;
};

/**
 * The symbol stays inline so its neutral follows the current theme while the
 * signal bar uses the site's accessible orange token.
 */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 12a6 6 0 0 1 6-6h34v12H18v28h28v12H12a6 6 0 0 1-6-6V12Z"
        fill="currentColor"
      />
      <rect className="fill-accent-strong" height="12" rx="6" width="50" x="6" y="26" />
    </svg>
  );
}

export function Logo({ className }: LogoMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark className="h-7 w-7 shrink-0" />
      <span className="text-[15.5px] font-bold tracking-tight">Engineerious</span>
    </span>
  );
}
