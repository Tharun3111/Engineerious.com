import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-md space-y-4 py-16">
      <p className="eyebrow">404</p>
      <h1 className="text-[24px] font-bold tracking-tight">Page not found</h1>
      <p className="text-[14.5px] text-muted">
        This page doesn&rsquo;t exist or isn&rsquo;t public yet. Choose a destination below.
      </p>
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link href="/" className="pill hover:border-accent hover:text-accent-strong">
            Go to homepage
          </Link>
        </li>
        <li>
          <Link href="/about" className="pill hover:border-accent hover:text-accent-strong">
            Learn about Engineerious
          </Link>
        </li>
        <li>
          <Link href="/subscribe" className="pill hover:border-accent hover:text-accent-strong">
            Subscribe for updates
          </Link>
        </li>
      </ul>
    </div>
  );
}
