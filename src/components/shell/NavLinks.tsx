"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Whether this item owns the current path (some pages belong under another item). */
  owns: (path: string) => boolean;
}

const MAIN: NavItem[] = [
  { href: "/", label: "Today", icon: "today", owns: (p) => p === "/" || p.startsWith("/history") },
  { href: "/browse", label: "Browse", icon: "browse", owns: (p) => p.startsWith("/browse") },
  { href: "/watchlist", label: "Watchlist", icon: "watchlist", owns: (p) => p.startsWith("/watchlist") },
  { href: "/collection", label: "Collection", icon: "collection", owns: (p) => p.startsWith("/collection") },
];

const FOOTER: NavItem[] = [
  { href: "/settings", label: "Settings", icon: "settings", owns: (p) => p.startsWith("/settings") },
];

/** The site's links. `sidebar` is the vertical desktop list; `tabbar` is the phone bottom bar. */
export default function NavLinks({
  variant,
  group = "main",
}: {
  variant: "sidebar" | "tabbar";
  group?: "main" | "footer";
}) {
  const path = usePathname() ?? "/";
  const items = group === "main" ? MAIN : FOOTER;

  if (variant === "tabbar") {
    return (
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active = item.owns(path);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[0.6875rem] font-medium ${
                  active ? "text-accent-text" : "text-subtle"
                }`}
              >
                <Icon name={item.icon} className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = item.owns(path);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              <Icon name={item.icon} className="h-[1.125rem] w-[1.125rem]" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
