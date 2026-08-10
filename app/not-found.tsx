import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-md space-y-4 py-16">
      <p className="eyebrow">404</p>
      <h1 className="text-[24px] font-bold tracking-tight">Not found</h1>
      <p className="text-[14.5px] text-muted">
        That page does not exist or is not public yet.
      </p>
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link href="/" className="pill hover:border-accent hover:text-accent-strong">
            Front page
          </Link>
        </li>
        <li>
          <Link href="/about" className="pill hover:border-accent hover:text-accent-strong">
            About
          </Link>
        </li>
        <li>
          <Link href="/subscribe" className="pill hover:border-accent hover:text-accent-strong">
            Subscribe
          </Link>
        </li>
      </ul>
    </div>
  );
}
