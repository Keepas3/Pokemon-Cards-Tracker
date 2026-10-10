import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

/** The site mark and name; links home. */
export default function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-fg">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-fg" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="8" />
          <path d="M4 12h16" />
          <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
        </svg>
      </span>
      {APP_NAME}
    </Link>
  );
}
